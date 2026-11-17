// VELMARA: Streets of Gold — the player: Riko Vale, on foot and behind the wheel.
// Movement, combat (fists and pistol), health, and getting in and out of cars.
'use strict';

function makePlayer(x, y) {
  return {
    x: x, y: y, angle: -Math.PI / 2,
    vx: 0, vy: 0,
    health: PLAYER_HEALTH,
    maxHealth: PLAYER_HEALTH,
    inCar: false,
    weapon: 'fists',   // fists | pistol
    ammo: 24,
    cash: START_CASH,
    lastDamageT: -99,
    shootCooldown: 0,
    punchCooldown: 0,
    muzzleT: 0,
    walkPhase: 0,
    moving: false
  };
}

function updatePlayer(dt) {
  var p = G.player;
  p.shootCooldown = Math.max(0, p.shootCooldown - dt);
  p.punchCooldown = Math.max(0, p.punchCooldown - dt);
  p.muzzleT = Math.max(0, p.muzzleT - dt);

  if (p.inCar) {
    // E steps out of the car.
    if (keyPressed('e')) exitCar(false);
    updatePlayerCar(dt);
    return;
  }

  var mv = moveVector();
  var running = keyDown('Shift');
  var speed = running ? RUN_SPEED : WALK_SPEED;
  p.moving = (mv.x !== 0 || mv.y !== 0);
  if (p.moving) {
    p.x += mv.x * speed * dt;
    p.y += mv.y * speed * dt;
    p.walkPhase += dt * speed * 0.09;
    // Face the aim direction when armed, else the movement direction.
    if (p.weapon === 'pistol') p.angle = aimAngle(p.x, p.y, G.cam);
    else if (mv.x !== 0 || mv.y !== 0) p.angle = Math.atan2(mv.y, mv.x);
  } else if (p.weapon === 'pistol') {
    p.angle = aimAngle(p.x, p.y, G.cam);
  }
  // Walls, water, world edge.
  collideCircleBuildings(p, PLAYER_RADIUS);
  if (p.y > WATER_Y - 14) p.y = WATER_Y - 14;
  clampToWorld(p, 20);

  // Slow health regen after 5 s without damage.
  if (G.time - p.lastDamageT > 5 && p.health < p.maxHealth) {
    p.health = Math.min(p.maxHealth, p.health + PLAYER_REGEN * dt);
  }

  // Enter a car.
  if (keyPressed('e')) {
    var c = nearestEnterableCar();
    if (c) enterCar(c);
    else showToast('No car in reach — get closer to a parked car.');
  }
  // Switch weapon.
  if (keyPressed('1')) { p.weapon = 'fists'; }
  if (keyPressed('2')) { p.weapon = 'pistol'; }
  if (keyPressed('r') && p.weapon === 'pistol') reloadPistol();
  // Attack: click (or hold) to punch or shoot.
  if (Input.mouseDown || Input.mouseClicked) {
    if (p.weapon === 'pistol') tryShoot();
    else tryPunch();
  }
  // Touch pickups: health, ammo.
  collectPickups();
}

function reloadPistol() {
  var p = G.player;
  if (p.ammo >= 12) return;
  if (p.cash < AMMO_COST) { showToast('Not enough cash for ammo — $' + AMMO_COST + ' a box.'); return; }
  p.cash -= AMMO_COST;
  p.ammo = Math.min(48, p.ammo + AMMO_PACK);
  showToast('Bought ammo. $' + AMMO_COST + ' — stay safe out there.');
  sfxPickup();
}

function tryShoot() {
  var p = G.player;
  if (p.shootCooldown > 0) return;
  if (p.ammo <= 0) {
    showToast('Out of ammo! Press R to buy a box ($' + AMMO_COST + ').');
    p.shootCooldown = 0.4;
    return;
  }
  p.ammo--;
  p.shootCooldown = 0.22;
  p.muzzleT = 0.07;
  var a = p.angle;
  var range = 520;
  var hx = p.x + Math.cos(a) * range;
  var hy = p.y + Math.sin(a) * range;
  // Hit the nearest cop or ped roughly on the bullet line.
  var best = null, bd = 1e18;
  var targets = [];
  for (var i = 0; i < G.cops.length; i++) targets.push({ x: G.cops[i].x, y: G.cops[i].y, kind: 'cop', ref: G.cops[i] });
  for (var j = 0; j < G.peds.length; j++) {
    if (G.peds[j].state !== 'down') targets.push({ x: G.peds[j].x, y: G.peds[j].y, kind: 'ped', ref: G.peds[j] });
  }
  for (var k = 0; k < targets.length; k++) {
    var t = targets[k];
    var dx = t.x - p.x, dy = t.y - p.y;
    var along = dx * Math.cos(a) + dy * Math.sin(a);
    if (along < 0 || along > range) continue;
    var perp = Math.abs(-dx * Math.sin(a) + dy * Math.cos(a));
    if (perp < 20 && along < bd) { bd = along; best = t; }
  }
  if (best) {
    hx = best.x; hy = best.y;
    if (best.kind === 'cop') damageCop(best.ref, 34);
    else {
      best.ref.state = 'down';
      best.ref.stateT = 4;
      addHeat(12, 'pedestrian shot');
      addParticles(best.x, best.y, 8, '#e74c3c');
    }
  }
  addBulletTracer(p.x + Math.cos(a) * 18, p.y + Math.sin(a) * 18, hx, hy);
  addParticles(hx, hy, 4, '#f5c542');
  sfxShoot();
  addHeat(4, 'gunfire');
  scareNearbyPeds(p.x, p.y, 420);
}

function tryPunch() {
  var p = G.player;
  if (p.punchCooldown > 0) return;
  p.punchCooldown = 0.35;
  var a = p.angle;
  var hx = p.x + Math.cos(a) * 26;
  var hy = p.y + Math.sin(a) * 26;
  // Punch the nearest cop or ped in front of the player.
  var best = null, bd = 1e18;
  for (var i = 0; i < G.cops.length; i++) {
    var c = G.cops[i];
    var d = dist(hx, hy, c.x, c.y);
    if (d < 34 && d < bd) { bd = d; best = { kind: 'cop', ref: c }; }
  }
  for (var j = 0; j < G.peds.length; j++) {
    var pd = G.peds[j];
    if (pd.state === 'down') continue;
    var d2 = dist(hx, hy, pd.x, pd.y);
    if (d2 < 30 && d2 < bd) { bd = d2; best = { kind: 'ped', ref: pd }; }
  }
  if (best) {
    if (best.kind === 'cop') damageCop(best.ref, 12);
    else {
      best.ref.state = 'down';
      best.ref.stateT = 3;
      addHeat(8, 'pedestrian punched');
      addParticles(best.ref.x, best.ref.y, 6, '#e74c3c');
    }
  }
  sfxPunch();
}

// Pickups scattered at landmarks: health at the clinic, ammo at the gun shop.
function collectPickups() {
  var p = G.player;
  for (var i = G.pickups.length - 1; i >= 0; i--) {
    var pk = G.pickups[i];
    if (dist(p.x, p.y, pk.x, pk.y) < 34) {
      if (pk.kind === 'health') {
        if (p.health >= p.maxHealth) continue;
        p.health = Math.min(p.maxHealth, p.health + 40);
        showToast('Patched up at Clinica Sol. +40 health.');
      } else if (pk.kind === 'ammo') {
        p.ammo = Math.min(96, p.ammo + AMMO_PACK);
        showToast('Ammo restocked. +' + AMMO_PACK + ' rounds.');
      }
      sfxPickup();
      G.pickups.splice(i, 1);
      pk.respawnT = 25;
      G.pickupTimers.push(pk);
    }
  }
}

function damagePlayer(amount, cause) {
  var p = G.player;
  p.health -= amount;
  p.lastDamageT = G.time;
  var hurt = document.getElementById('hurt');
  if (hurt) { hurt.style.opacity = 0.85; setTimeout(function () { hurt.style.opacity = 0; }, 160); }
  addShake(4);
  if (p.health <= 0) {
    p.health = 0;
    wasted(cause || 'You did not make it out of Velmara.');
  }
}

// Arrested: lose a little cash and heat, respawn at the safehouse.
// Staged screenshot scenes never end: the photo is the point.
function busted(msg) {
  if (G.state !== 'playing' || G.shotMode) return;
  var fine = Math.min(G.player.cash, 150);
  G.player.cash -= fine;
  G.heat = 0;
  clearWanted();
  G.player.health = G.player.maxHealth;
  G.player.ammo = Math.max(G.player.ammo, 12);
  endScreen('BUSTED', msg + ' Fine: $' + fine + '. Marisol bailed you out — back to the safehouse.', 'busted');
  failCurrentMission('You got busted.');
}

// Killed: lose a little cash, respawn at the clinic.
// Staged screenshot scenes never end: the photo is the point.
function wasted(msg) {
  if (G.state !== 'playing' || G.shotMode) return;
  var lost = Math.min(G.player.cash, 100);
  G.player.cash -= lost;
  G.heat = Math.max(0, G.heat - 20);
  G.player.health = G.player.maxHealth;
  endScreen('WASTED', msg + ' You wake up at Clinica Sol, $' + lost + ' lighter.', 'wasted');
  failCurrentMission('You got wasted.');
}
