// VELMARA: Streets of Gold — HUD: objective panel, stars, cash, clock,
// health, weapon, minimap, banners, subtitles and toasts.
'use strict';

var _subtitleTimer = null;
var _toastTimer = null;
var _bannerTimer = null;

function $(id) { return document.getElementById(id); }

function updateObjectiveHUD() {
  var title = $('obj-title');
  var text = $('obj-text');
  var distEl = $('obj-dist');
  if (!title) return;
  var obj = currentObjective();
  if (G.mission && obj) {
    title.textContent = obj.title;
    text.textContent = obj.step.text;
    if (obj.pos) {
      var d = Math.round(dist(G.player.x, G.player.y, obj.pos.x, obj.pos.y));
      distEl.textContent = d + ' m  ·  follow the yellow marker';
    } else {
      distEl.textContent = '';
    }
  } else if (G.missionIndex < MISSIONS.length) {
    title.textContent = 'Next job';
    text.textContent = 'Go to the yellow M marker to start: ' + MISSIONS[G.missionIndex].title;
    var mp = missionMarkerPos();
    var d2 = Math.round(dist(G.player.x, G.player.y, mp.x, mp.y));
    distEl.textContent = d2 + ' m  ·  Marisol is waiting';
  } else {
    title.textContent = 'King of Velmara';
    text.textContent = 'Story complete. Taxi fares appear on the map — keep earning, keep the streets yours.';
    distEl.textContent = '';
  }
  // Fare objective overrides when a taxi fare is active.
  if (G.fare && G.fare.state === 'pickup') {
    title.textContent = 'Taxi fare';
    text.textContent = 'Pick up the passenger';
    distEl.textContent = Math.round(dist(G.player.x, G.player.y, G.fare.px, G.fare.py)) + ' m';
  } else if (G.fare && G.fare.state === 'dropoff') {
    title.textContent = 'Taxi fare';
    text.textContent = 'Drop the passenger at the destination';
    distEl.textContent = Math.round(dist(G.player.x, G.player.y, G.fare.dx, G.fare.dy)) + ' m';
  }
}

function updateStatsHUD() {
  var starsEl = $('stars');
  if (!starsEl) return;
  var s = wantedStars();
  var html = '';
  for (var i = 0; i < MAX_STARS; i++) {
    html += i < s ? '★' : '<span class="off">★</span>';
  }
  starsEl.innerHTML = html;
  $('cash').textContent = '$' + Math.floor(G.player.cash).toLocaleString('en-US');
  var mins = Math.floor(G.clockMinutes) % 1440;
  var hh = Math.floor(mins / 60);
  var mm = mins % 60;
  var day = Math.floor(G.clockMinutes / 1440) + 1;
  var ap = hh >= 12 ? 'PM' : 'AM';
  var h12 = hh % 12 === 0 ? 12 : hh % 12;
  $('clock').textContent = 'Day ' + day + ' — ' + h12 + ':' + (mm < 10 ? '0' : '') + mm + ' ' + ap;
  var hp = clamp(G.player.health / G.player.maxHealth, 0, 1);
  var fill = $('health-fill');
  fill.style.width = Math.round(hp * 100) + '%';
  fill.style.background = hp > 0.5 ? 'linear-gradient(90deg,#37d67a,#a5e34d)' :
    (hp > 0.25 ? 'linear-gradient(90deg,#f5a623,#f5d76a)' : 'linear-gradient(90deg,#e74c3c,#ff7b6b)');
  var wname = G.player.weapon === 'pistol' ? 'Pistol' : 'Fists';
  var ammo = G.player.weapon === 'pistol' ? ' · ' + G.player.ammo + ' rounds' : '';
  var carName = G.playerCar ? ' · in ' + G.playerCar.name : '';
  $('weapon').innerHTML = '<b>' + wname + '</b>' + ammo + carName;
  var d = districtAt(G.player.x, G.player.y);
  $('district').textContent = d.name + ' — ' + d.blurb;
}

// ---- Minimap ----
var _mm = null;
function drawMinimap() {
  var cv = $('minimap');
  if (!cv) return;
  if (!_mm) _mm = cv.getContext('2d');
  var ctx = _mm;
  var W = cv.width, H = cv.height;
  var sx = W / WORLD_W, sy = H / WORLD_H;
  ctx.clearRect(0, 0, W, H);
  // Land.
  ctx.fillStyle = '#2c3a2e';
  ctx.fillRect(0, 0, W, H);
  // Water.
  ctx.fillStyle = '#1d5f8a';
  ctx.fillRect(0, WATER_Y * sy, W, H - WATER_Y * sy);
  // Sand.
  ctx.fillStyle = '#c9b078';
  ctx.fillRect(0, SAND_TOP * sy, W, (WATER_Y - SAND_TOP) * sy);
  // Roads.
  ctx.strokeStyle = '#5a6068';
  ctx.lineWidth = 2;
  for (var i = 0; i < AVENUES.length; i++) {
    ctx.beginPath();
    ctx.moveTo(AVENUES[i] * sx, 0);
    ctx.lineTo(AVENUES[i] * sx, WATER_Y * sy);
    ctx.stroke();
  }
  for (var j = 0; j < STREETS.length; j++) {
    ctx.beginPath();
    ctx.moveTo(0, STREETS[j] * sy);
    ctx.lineTo(W, STREETS[j] * sy);
    ctx.stroke();
  }
  // Buildings.
  ctx.fillStyle = '#8a94a6';
  for (var b = 0; b < CITY.buildings.length; b++) {
    var bd = CITY.buildings[b];
    ctx.fillRect(bd.x * sx, bd.y * sy, Math.max(1.5, bd.w * sx), Math.max(1.5, bd.h * sy));
  }
  // Mission marker / objective blip.
  var obj = currentObjective();
  var blink = Math.floor(G.time * 3) % 2 === 0;
  if (obj && obj.pos && blink) {
    ctx.fillStyle = '#f5c542';
    ctx.beginPath();
    ctx.arc(obj.pos.x * sx, obj.pos.y * sy, 5, 0, Math.PI * 2);
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }
  if (!G.mission && G.missionIndex < MISSIONS.length) {
    var mp = missionMarkerPos();
    ctx.fillStyle = '#f5c542';
    ctx.font = 'bold 11px sans-serif';
    ctx.fillText('M', mp.x * sx - 4, mp.y * sy + 4);
  }
  // Taxi fare.
  if (G.fare) {
    ctx.fillStyle = '#7dff8a';
    var fx = G.fare.state === 'pickup' ? G.fare.px : G.fare.dx;
    var fy = G.fare.state === 'pickup' ? G.fare.py : G.fare.dy;
    ctx.beginPath();
    ctx.arc(fx * sx, fy * sy, 4, 0, Math.PI * 2);
    ctx.fill();
  }
  // Cops (red-blue) and traffic (white).
  for (var c = 0; c < G.cars.length; c++) {
    var car = G.cars[c];
    if (car.isPlayer) continue;
    ctx.fillStyle = car.isCop ? '#ff5a4e' : 'rgba(255,255,255,0.75)';
    ctx.fillRect(car.x * sx - 1.5, car.y * sy - 1.5, 3, 3);
  }
  // Player arrow.
  var px = G.player.x * sx, py = G.player.y * sy;
  ctx.save();
  ctx.translate(px, py);
  ctx.rotate(G.player.angle);
  ctx.fillStyle = '#fff';
  ctx.beginPath();
  ctx.moveTo(7, 0);
  ctx.lineTo(-5, -4.5);
  ctx.lineTo(-5, 4.5);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#111';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.restore();
  // Viewport rectangle.
  ctx.strokeStyle = 'rgba(255,255,255,0.5)';
  ctx.lineWidth = 1;
  var vw = G.cam.viewW / G.cam.zoom * sx;
  var vh = G.cam.viewH / G.cam.zoom * sy;
  ctx.strokeRect((G.cam.x - G.cam.viewW / G.cam.zoom / 2) * sx, (G.cam.y - G.cam.viewH / G.cam.zoom / 2) * sy, vw, vh);
}

// ---- Banners, subtitles, toasts ----

function showBanner(title, sub, bad) {
  var b = $('banner');
  var t = $('banner-title');
  var s = $('banner-sub');
  if (!b) return;
  t.textContent = title;
  t.className = bad ? 'bad' : '';
  s.textContent = sub || '';
  b.style.display = 'block';
  if (_bannerTimer) clearTimeout(_bannerTimer);
  _bannerTimer = setTimeout(function () { b.style.display = 'none'; }, 3200);
}

function showSubtitle(who, line) {
  var el = $('subtitle');
  if (!el) return;
  el.innerHTML = '<span class="who">' + who + ':</span> ' + line;
  el.style.display = 'block';
  if (_subtitleTimer) clearTimeout(_subtitleTimer);
  _subtitleTimer = setTimeout(function () { el.style.display = 'none'; }, 4200);
}

function showSubtitleSequence(lines) {
  if (!lines || !lines.length) return;
  var i = 0;
  showSubtitle(lines[0][0], lines[0][1]);
  var iv = setInterval(function () {
    i++;
    if (i >= lines.length || G.state !== 'playing') { clearInterval(iv); return; }
    showSubtitle(lines[i][0], lines[i][1]);
  }, 4400);
}

function showToast(msg) {
  var el = $('toast');
  if (!el) return;
  el.textContent = msg;
  el.style.display = 'block';
  if (_toastTimer) clearTimeout(_toastTimer);
  _toastTimer = setTimeout(function () { el.style.display = 'none'; }, 3000);
}

function hideBanner() {
  var b = $('banner');
  if (b) b.style.display = 'none';
}

// ---- Screens ----

function showTitle() {
  $('title-screen').style.display = 'flex';
  $('pause-screen').style.display = 'none';
  $('end-screen').style.display = 'none';
  var cont = $('btn-continue');
  cont.style.display = hasSave() ? 'inline-block' : 'none';
}

function showPause() {
  $('pause-screen').style.display = 'flex';
  $('pause-info').textContent = 'Missions done: ' + G.completedMissions + ' / ' + MISSIONS.length +
    '  ·  Cash: $' + Math.floor(G.player.cash) + '  ·  Wanted: ' + wantedStars() + '★';
}

function hidePause() {
  $('pause-screen').style.display = 'none';
}

function endScreen(title, sub, kind) {
  G.state = 'end';
  $('end-title').textContent = title;
  $('end-sub').textContent = sub;
  $('end-screen').style.display = 'flex';
  saveGame();
}

function hideEnd() {
  $('end-screen').style.display = 'none';
}

function updateSoundButton() {
  var b = $('btn-sound');
  if (b) b.textContent = 'SOUND: ' + (AudioSys.enabled ? 'ON' : 'OFF');
}
