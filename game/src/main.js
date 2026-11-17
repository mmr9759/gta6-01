// VELMARA: Streets of Gold — game state, main loop, saving.
// Boots the city, runs the frame loop, and ties every system together.
'use strict';

var G = null;
var _lastT = 0;
var _raf = 0;

function newGameState() {
  return {
    state: 'title',        // title | playing | paused | end
    time: 0,               // seconds since boot
    clockMinutes: 8 * 60,  // game clock starts 08:00 day 1
    player: null,
    playerCar: null,
    cars: [],
    peds: [],
    cops: [],
    pickups: [],
    pickupTimers: [],
    particles: [],
    tracers: [],
    skids: [],
    heat: 0,
    lastCrimeT: -99,
    mission: null,
    missionIndex: 0,
    completedMissions: 0,
    fare: null,
    cam: { x: 1800, y: 1300, zoom: 1, viewW: 1280, viewH: 720, sx: 0, sy: 0 },
    shake: 0,
    sprayCooldown: 0,
    autoDrive: false,
    autoTarget: null,
    shotMode: 0,
    shotT: 0,
    debugWanted: false
  };
}

function initGame() {
  G = newGameState();
  genCity();
  G.player = makePlayer(CITY.landmarks.safehouse.x, CITY.landmarks.safehouse.y);
  G.cars = spawnTraffic();
  G.peds = spawnPeds();
  spawnPickups();
  G.cam.x = G.player.x;
  G.cam.y = G.player.y;
}

function spawnPickups() {
  var L = CITY.landmarks;
  G.pickups = [
    { kind: 'health', x: L.hospital.x, y: L.hospital.y, respawnT: 0 },
    { kind: 'ammo', x: L.gunshop.x, y: L.gunshop.y, respawnT: 0 }
  ];
}

// ---- Save / load (localStorage) ----

function hasSave() {
  try { return !!window.localStorage.getItem(SAVE_KEY); } catch (e) { return false; }
}

function saveGame() {
  try {
    var p = G.player;
    window.localStorage.setItem(SAVE_KEY, JSON.stringify({
      cash: Math.floor(p.cash),
      missionIndex: G.missionIndex,
      completedMissions: G.completedMissions,
      x: Math.round(p.x), y: Math.round(p.y),
      health: Math.round(p.health),
      ammo: p.ammo,
      clockMinutes: Math.round(G.clockMinutes),
      weapon: p.weapon
    }));
  } catch (e) {}
}

function loadSave() {
  try {
    var raw = window.localStorage.getItem(SAVE_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch (e) { return null; }
}

function applySave(s) {
  G.player.cash = s.cash || START_CASH;
  G.missionIndex = s.missionIndex || 0;
  G.completedMissions = s.completedMissions || 0;
  G.player.x = clamp(s.x || CITY.landmarks.safehouse.x, 40, WORLD_W - 40);
  G.player.y = clamp(s.y || CITY.landmarks.safehouse.y, 40, SAND_TOP - 20);
  G.player.health = s.health || PLAYER_HEALTH;
  G.player.ammo = (typeof s.ammo === 'number') ? s.ammo : 24;
  G.clockMinutes = s.clockMinutes || 8 * 60;
  G.player.weapon = s.weapon || 'fists';
  G.cam.x = G.player.x;
  G.cam.y = G.player.y;
}

// ---- Pay-n-spray: drive in, pay up, lose the heat ----

function updateSpray(dt) {
  G.sprayCooldown = Math.max(0, G.sprayCooldown - dt);
  if (!G.playerCar || G.sprayCooldown > 0) return;
  var L = CITY.landmarks.spray;
  if (dist(G.player.x, G.player.y, L.x, L.y) < 80 && Math.abs(G.playerCar.speed) < 120) {
    if (G.player.cash < SPRAY_COST) {
      showToast('Pintura Rosa costs $' + SPRAY_COST + ' — you are short.');
      G.sprayCooldown = 4;
      return;
    }
    G.player.cash -= SPRAY_COST;
    G.playerCar.health = 100;
    clearWanted();
    addParticles(G.player.x, G.player.y, 18, '#ff9ff3');
    showBanner('RESPRAYED', 'New paint, no heat. The cops lost your trail.', false);
    sfxMissionPass();
    G.sprayCooldown = 8;
  }
}

// ---- The frame update ----

function update(dt) {
  G.time += dt;
  G.clockMinutes += dt * MINUTES_PER_SECOND;

  if (G.state === 'title') {
    // Attract mode: slow pan over Centro while the title shows.
    var t = G.time * 0.05;
    G.cam.x = 1800 + Math.cos(t) * 500;
    G.cam.y = 1300 + Math.sin(t * 0.7) * 300;
    G.cam.zoom = lerp(G.cam.zoom, 0.8, dt);
    G.cam.viewW = _canvas.width;
    G.cam.viewH = _canvas.height;
    for (var i = 0; i < G.cars.length; i++) updateTrafficCar(G.cars[i], dt);
    updatePeds(dt);
    updateParticles(dt);
    return;
  }
  if (G.state !== 'playing') {
    updateParticles(dt);
    return;
  }

  if (G.autoDrive) autoDrivePlayer(dt);
  else updatePlayer(dt);

  for (var j = 0; j < G.cars.length; j++) {
    var c = G.cars[j];
    if (!c.isPlayer && !c.isCop) updateTrafficCar(c, dt);
  }
  collideCars(dt);
  carHitPeds();
  updatePeds(dt);
  maintainPeds();
  maintainTraffic();
  updatePolice(dt);
  updateMissions(dt);
  updateSpray(dt);
  updateParticles(dt);

  // Pickup respawns.
  for (var k = G.pickupTimers.length - 1; k >= 0; k--) {
    var pk = G.pickupTimers[k];
    pk.respawnT -= dt;
    if (pk.respawnT <= 0) {
      G.pickups.push(pk);
      G.pickupTimers.splice(k, 1);
    }
  }

  // Audio: engine from the player's car, siren from the nearest cop.
  var speedNorm = G.playerCar ? clamp(Math.abs(G.playerCar.speed) / 470, 0, 1) : 0;
  audioUpdate(dt, speedNorm, nearestCopDist(), !!G.playerCar);

  updateCamera(dt);
  updateObjectiveHUD();
  updateStatsHUD();
  drawMinimap();
  inputEndFrame();
}

// ---- Frame loop ----

function frame(ts) {
  _raf = requestAnimationFrame(frame);
  var dt = _lastT ? (ts - _lastT) / 1000 : 0.016;
  _lastT = ts;
  if (dt > 0.05) dt = 0.05; // clamp hitches so physics stays stable
  try {
    resizeCanvas();
    update(dt);
    drawWorld();
    if (!window.__gameReady) window.__gameReady = true;
  } catch (err) {
    window.__gameError = String(err && err.message || err);
  }
}

// ---- Buttons and toggles ----

function onSoundToggle() {
  audioInit();
  audioSetEnabled(!AudioSys.enabled);
  updateSoundButton();
}

function onPauseToggle() {
  if (G.state === 'playing') {
    G.state = 'paused';
    showPause();
  } else if (G.state === 'paused') {
    G.state = 'playing';
    hidePause();
  }
}

function startNewGame() {
  audioInit();
  audioResume();
  initGame();
  G.state = 'playing';
  $('title-screen').style.display = 'none';
  $('loading').style.display = 'none';
  showSubtitle('MARISOL', 'Riko. First job, easy money. Go to the yellow M — Mercado Viejo.');
  updateObjectiveHUD();
  updateStatsHUD();
}

function continueGame() {
  var s = loadSave();
  audioInit();
  audioResume();
  initGame();
  if (s) applySave(s);
  G.state = 'playing';
  $('title-screen').style.display = 'none';
  $('loading').style.display = 'none';
  showToast('Welcome back to Velmara, Riko.');
  updateObjectiveHUD();
  updateStatsHUD();
}

function retryAfterEnd() {
  // Respawn at the clinic / safehouse and keep playing the same story.
  var p = G.player;
  p.x = CITY.landmarks.safehouse.x;
  p.y = CITY.landmarks.safehouse.y;
  p.health = p.maxHealth;
  if (G.playerCar) { G.playerCar.isPlayer = false; G.playerCar = null; p.inCar = false; }
  G.cam.x = p.x;
  G.cam.y = p.y;
  G.state = 'playing';
  hideEnd();
  hideBanner();
  updateObjectiveHUD();
}

function wireButtons() {
  $('btn-new').addEventListener('click', startNewGame);
  $('btn-continue').addEventListener('click', continueGame);
  $('btn-sound').addEventListener('click', onSoundToggle);
  $('btn-resume').addEventListener('click', onPauseToggle);
  $('btn-save').addEventListener('click', function () { saveGame(); showToast('Game saved.'); });
  $('btn-quit').addEventListener('click', function () {
    saveGame();
    hidePause();
    G.state = 'title';
    showTitle();
  });
  $('btn-retry').addEventListener('click', retryAfterEnd);
  $('btn-end-quit').addEventListener('click', function () {
    hideEnd();
    G.state = 'title';
    showTitle();
  });
  window.addEventListener('resize', resizeCanvas);
}

// ---- Boot ----

window.addEventListener('error', function (e) {
  window.__gameError = String(e.message || e.error || 'unknown error');
});

function boot() {
  var canvas = $('game');
  renderInit(canvas);
  inputInit(canvas);
  audioInit();
  initGame();
  wireButtons();
  updateSoundButton();
  showTitle();
  $('loading').style.display = 'none';
  var shot = shotParam();
  if (shot >= 1 && shot <= SHOT_COUNT) {
    // Screenshot staging: straight into a live scene, no title screen.
    stageShot(shot);
    G.state = 'playing';
  }
  _lastT = 0;
  _raf = requestAnimationFrame(frame);
  // Expose a small state snapshot for automated checks.
  window.__gameState = function () {
    return {
      state: G.state,
      player: { x: Math.round(G.player.x), y: Math.round(G.player.y), inCar: G.player.inCar, health: Math.round(G.player.health) },
      cars: G.cars.length,
      peds: G.peds.length,
      cops: G.cops.length,
      stars: wantedStars(),
      cash: Math.floor(G.player.cash),
      missionIndex: G.missionIndex,
      mission: G.mission ? G.mission.def.id + ':' + G.mission.step : null,
      clock: Math.round(G.clockMinutes),
      error: window.__gameError || null
    };
  };
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', boot);
} else {
  boot();
}
