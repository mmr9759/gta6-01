// VELMARA: Streets of Gold — rendering.
// One canvas, one camera: the ground, roads, water, buildings with fake height,
// palms and lamps, cars, people, effects, and the day-night tint.
'use strict';

var _ctx = null;
var _canvas = null;

function renderInit(canvas) {
  _canvas = canvas;
  _ctx = canvas.getContext('2d');
}

function resizeCanvas() {
  if (!_canvas) return;
  var w = window.innerWidth, h = window.innerHeight;
  if (_canvas.width !== w || _canvas.height !== h) {
    _canvas.width = w;
    _canvas.height = h;
  }
}

// The camera follows the player (or the car), zooming out a little at speed.
function updateCamera(dt) {
  var cam = G.cam;
  var target = G.playerCar || G.player;
  var tx = target.x, ty = target.y;
  if (G.playerCar) {
    // Look ahead in the driving direction.
    tx += Math.cos(G.playerCar.angle) * G.playerCar.speed * 0.28;
    ty += Math.sin(G.playerCar.angle) * G.playerCar.speed * 0.28;
  }
  var speedNorm = G.playerCar ? clamp(Math.abs(G.playerCar.speed) / 470, 0, 1) : 0;
  var targetZoom = G.playerCar ? 0.92 - speedNorm * 0.22 : 1.05;
  cam.x = lerp(cam.x, tx, 1 - Math.pow(0.0001, dt));
  cam.y = lerp(cam.y, ty, 1 - Math.pow(0.0001, dt));
  cam.zoom = lerp(cam.zoom, targetZoom, 1 - Math.pow(0.001, dt));
  cam.viewW = _canvas.width;
  cam.viewH = _canvas.height;
  // Screen shake.
  if (G.shake > 0.2) {
    cam.sx = rand(-G.shake, G.shake);
    cam.sy = rand(-G.shake, G.shake);
    G.shake *= Math.pow(0.02, dt);
  } else {
    cam.sx = 0; cam.sy = 0;
  }
}

function addShake(amount) {
  G.shake = Math.min(16, G.shake + amount);
}

// Day tint: 0 = deep night, 1 = bright noon. Used for the light overlay.
function daylight() {
  var mins = G.clockMinutes % 1440;
  if (mins < 300) return 0.12;                    // 00:00-05:00 night
  if (mins < 420) return lerp(0.12, 0.85, (mins - 300) / 120); // dawn
  if (mins < 1020) return 1;                      // 07:00-17:00 day
  if (mins < 1140) return lerp(1, 0.45, (mins - 1020) / 120);  // sunset
  if (mins < 1260) return lerp(0.45, 0.12, (mins - 1140) / 120); // dusk
  return 0.12;
}

function isNight() {
  return daylight() < 0.4;
}

function drawWorld() {
  var ctx = _ctx;
  var cam = G.cam;
  var vw = _canvas.width / cam.zoom, vh = _canvas.height / cam.zoom;
  var x0 = cam.x - vw / 2 - 60, y0 = cam.y - vh / 2 - 60;
  var x1 = cam.x + vw / 2 + 60, y1 = cam.y + vh / 2 + 60;
  ctx.save();
  ctx.translate(_canvas.width / 2 + cam.sx, _canvas.height / 2 + cam.sy);
  ctx.scale(cam.zoom, cam.zoom);
  ctx.translate(-cam.x, -cam.y);

  drawGround(ctx, x0, y0, x1, y1);
  drawRoads(ctx, x0, y0, x1, y1);
  drawPiers(ctx);
  drawBuildings(ctx, x0, y0, x1, y1);
  drawProps(ctx, x0, y0, x1, y1);
  drawPickups(ctx);
  drawMissionMarker(ctx);
  drawOffscreenArrow(ctx);
  drawPeds(ctx, x0, y0, x1, y1);
  drawCars(ctx, x0, y0, x1, y1);
  drawPlayer(ctx);
  drawParticles(ctx);
  drawTracers(ctx);
  drawSkids(ctx);
  drawDayTint(ctx, x0, y0, x1, y1);
  ctx.restore();
}

function drawGround(ctx, x0, y0, x1, y1) {
  // Base land: warm concrete-grey.
  ctx.fillStyle = '#a9a294';
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Grass parks.
  ctx.fillStyle = '#5d8a4a';
  for (var i = 0; i < DISTRICTS.length; i++) {
    var d = DISTRICTS[i];
    if (d.id === 'park') ctx.fillRect(d.x0, d.y0, d.x1 - d.x0, Math.min(d.y1, SAND_TOP) - d.y0);
  }
  // Beach sand.
  ctx.fillStyle = '#e3cd96';
  ctx.fillRect(x0, SAND_TOP, x1 - x0, WATER_Y - SAND_TOP);
  // Harbor water with a slow shimmer.
  var grad = ctx.createLinearGradient(0, WATER_Y, 0, WORLD_H);
  grad.addColorStop(0, '#2a7ab0');
  grad.addColorStop(1, '#155a86');
  ctx.fillStyle = grad;
  ctx.fillRect(x0, WATER_Y, x1 - x0, WORLD_H - WATER_Y);
  // Sparkle lines on the water.
  ctx.strokeStyle = 'rgba(255,255,255,0.28)';
  ctx.lineWidth = 2;
  var t = G.time;
  for (var s = 0; s < 24; s++) {
    var sx = x0 + hash2(s, 7) * (x1 - x0);
    var sy = WATER_Y + 12 + hash2(s, 13) * (WORLD_H - WATER_Y - 24);
    var wob = Math.sin(t * 1.4 + s * 1.7) * 8;
    ctx.beginPath();
    ctx.moveTo(sx - 22 + wob, sy);
    ctx.lineTo(sx + 22 + wob, sy);
    ctx.stroke();
  }
}

function drawRoads(ctx, x0, y0, x1, y1) {
  // Sidewalks first (a pale band around each road), then asphalt.
  ctx.fillStyle = '#c9c2b2';
  for (var i = 0; i < AVENUES.length; i++) {
    var ax = AVENUES[i];
    if (ax + ROAD_W / 2 + SIDEWALK < x0 || ax - ROAD_W / 2 - SIDEWALK > x1) continue;
    ctx.fillRect(ax - ROAD_W / 2 - SIDEWALK, y0, ROAD_W + SIDEWALK * 2, y1 - y0);
  }
  for (var j = 0; j < STREETS.length; j++) {
    var sy = STREETS[j];
    if (sy + STREET_W / 2 + SIDEWALK < y0 || sy - STREET_W / 2 - SIDEWALK > y1) continue;
    ctx.fillRect(x0, sy - STREET_W / 2 - SIDEWALK, x1 - x0, STREET_W + SIDEWALK * 2);
  }
  ctx.fillStyle = '#3a3f46';
  for (var a = 0; a < AVENUES.length; a++) {
    var ax2 = AVENUES[a];
    if (ax2 + ROAD_W / 2 < x0 || ax2 - ROAD_W / 2 > x1) continue;
    ctx.fillRect(ax2 - ROAD_W / 2, y0, ROAD_W, y1 - y0);
  }
  for (var s = 0; s < STREETS.length; s++) {
    var sy2 = STREETS[s];
    if (sy2 + STREET_W / 2 < y0 || sy2 - STREET_W / 2 > y1) continue;
    ctx.fillRect(x0, sy2 - STREET_W / 2, x1 - x0, STREET_W);
  }
  // Centre dashes and edge lines.
  ctx.strokeStyle = '#f5c542';
  ctx.lineWidth = 2;
  ctx.setLineDash([18, 16]);
  for (var a2 = 0; a2 < AVENUES.length; a2++) {
    var ax3 = AVENUES[a2];
    if (ax3 < x0 || ax3 > x1) continue;
    ctx.beginPath(); ctx.moveTo(ax3, Math.max(y0, 0)); ctx.lineTo(ax3, Math.min(y1, WATER_Y)); ctx.stroke();
  }
  for (var s2 = 0; s2 < STREETS.length; s2++) {
    var sy3 = STREETS[s2];
    if (sy3 < y0 || sy3 > y1) continue;
    ctx.beginPath(); ctx.moveTo(Math.max(x0, 0), sy3); ctx.lineTo(Math.min(x1, WORLD_W), sy3); ctx.stroke();
  }
  ctx.setLineDash([]);
  // Crosswalks at every intersection.
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  for (var ai = 0; ai < AVENUES.length; ai++) {
    for (var si = 0; si < STREETS.length; si++) {
      var cx = AVENUES[ai], cy = STREETS[si];
      if (cx < x0 - 60 || cx > x1 + 60 || cy < y0 - 60 || cy > y1 + 60) continue;
      for (var k = -2; k <= 2; k++) {
        ctx.fillRect(cx - ROAD_W / 2 + 4, cy - STREET_W / 2 - 10 + k * 8, ROAD_W - 8, 4);
        ctx.fillRect(cx - ROAD_W / 2 - 10 + k * 8, cy - STREET_W / 2 + 4, 4, STREET_W - 8);
      }
    }
  }
}

function drawPiers(ctx) {
  for (var i = 0; i < CITY.piers.length; i++) {
    var p = CITY.piers[i];
    ctx.fillStyle = '#8a6d4b';
    ctx.fillRect(p.x - p.w / 2, p.y, p.w, p.h);
    ctx.fillStyle = '#6d5439';
    for (var k = 0; k < 4; k++) ctx.fillRect(p.x - p.w / 2, p.y + 20 + k * 34, p.w, 3);
    ctx.fillStyle = '#5d4a33';
    ctx.fillRect(p.x - p.w / 2 - 4, p.y + p.h - 10, p.w + 8, 10);
  }
}

function drawBuildings(ctx, x0, y0, x1, y1) {
  var bs = CITY.buildings;
  for (var i = 0; i < bs.length; i++) {
    var b = bs[i];
    if (b.x + b.w < x0 || b.x > x1 || b.y + b.h < y0 || b.y > y1) continue;
    // Drop shadow: the fake height, cast south-east.
    ctx.fillStyle = 'rgba(0,0,0,0.28)';
    ctx.fillRect(b.x + b.height * 0.55, b.y + b.height * 0.55, b.w, b.h);
    // Side faces for a hint of 3D.
    ctx.fillStyle = shadeColor(b.roof, -28);
    ctx.fillRect(b.x, b.y + b.h, b.w, b.height * 0.5);
    ctx.fillStyle = shadeColor(b.roof, -18);
    ctx.fillRect(b.x + b.w, b.y, b.height * 0.5, b.h);
    // Roof.
    ctx.fillStyle = b.roof;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    // Parapet.
    ctx.strokeStyle = 'rgba(0,0,0,0.25)';
    ctx.lineWidth = 3;
    ctx.strokeRect(b.x + 1.5, b.y + 1.5, b.w - 3, b.h - 3);
    // Windows.
    ctx.fillStyle = 'rgba(255,255,220,0.75)';
    for (var w = 0; w < b.windows.length; w++) {
      var win = b.windows[w];
      ctx.fillRect(win[0], win[1], 12, 10);
    }
    // A rooftop AC unit or two on big buildings.
    if (b.tall && b.w > 90) {
      ctx.fillStyle = 'rgba(0,0,0,0.2)';
      ctx.fillRect(b.x + b.w / 2 - 12, b.y + b.h / 2 - 8, 24, 16);
    }
  }
}

function shadeColor(hex, amt) {
  var n = parseInt(hex.slice(1), 16);
  var r = clamp((n >> 16) + amt, 0, 255);
  var g = clamp(((n >> 8) & 255) + amt, 0, 255);
  var b = clamp((n & 255) + amt, 0, 255);
  return 'rgb(' + r + ',' + g + ',' + b + ')';
}

function drawProps(ctx, x0, y0, x1, y1) {
  // Trees in the park and blocks.
  for (var i = 0; i < CITY.trees.length; i++) {
    var t = CITY.trees[i];
    if (t.x < x0 || t.x > x1 || t.y < y0 || t.y > y1) continue;
    ctx.fillStyle = 'rgba(0,0,0,0.2)';
    ctx.beginPath(); ctx.ellipse(t.x + 6 * t.s, t.y + 8 * t.s, 16 * t.s, 10 * t.s, 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#3f7a34';
    ctx.beginPath(); ctx.arc(t.x, t.y, 15 * t.s, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#57a047';
    ctx.beginPath(); ctx.arc(t.x - 4 * t.s, t.y - 4 * t.s, 9 * t.s, 0, Math.PI * 2); ctx.fill();
  }
  // Palms along the coast.
  for (var j = 0; j < CITY.palms.length; j++) {
    var p = CITY.palms[j];
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    drawPalm(ctx, p.x, p.y, p.s);
  }
  // Lamps glow at night.
  var night = isNight();
  for (var k = 0; k < CITY.lamps.length; k++) {
    var l = CITY.lamps[k];
    if (l.x < x0 || l.x > x1 || l.y < y0 || l.y > y1) continue;
    ctx.fillStyle = '#3a3f46';
    ctx.fillRect(l.x - 2, l.y - 2, 4, 12);
    if (night) {
      ctx.fillStyle = 'rgba(255,220,120,0.25)';
      ctx.beginPath(); ctx.arc(l.x, l.y, 26, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath(); ctx.arc(l.x, l.y, 5, 0, Math.PI * 2); ctx.fill();
    } else {
      ctx.fillStyle = '#f5d76a';
      ctx.beginPath(); ctx.arc(l.x, l.y, 4, 0, Math.PI * 2); ctx.fill();
    }
  }
}

function drawPalm(ctx, x, y, s) {
  ctx.strokeStyle = '#7a5a34';
  ctx.lineWidth = 5 * s;
  ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 4 * s, y - 18 * s, x + 2 * s, y - 30 * s); ctx.stroke();
  ctx.strokeStyle = '#3f8a3a';
  ctx.lineWidth = 3.5 * s;
  for (var i = 0; i < 6; i++) {
    var a = (i / 6) * Math.PI * 2 + 0.4;
    ctx.beginPath();
    ctx.moveTo(x + 2 * s, y - 30 * s);
    ctx.quadraticCurveTo(x + Math.cos(a) * 20 * s, y - 30 * s + Math.sin(a) * 20 * s - 6 * s, x + Math.cos(a) * 26 * s, y - 30 * s + Math.sin(a) * 26 * s + 8 * s);
    ctx.stroke();
  }
  ctx.fillStyle = '#6d4c2f';
  ctx.beginPath(); ctx.arc(x + 2 * s, y - 28 * s, 4 * s, 0, Math.PI * 2); ctx.fill();
}

// ---- Particles, tracers, skid marks ----

function addParticles(x, y, n, color) {
  for (var i = 0; i < n; i++) {
    var a = rand(0, Math.PI * 2);
    var sp = rand(40, 220);
    G.particles.push({ x: x, y: y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: rand(0.3, 0.8), max: 0.8, color: color, size: rand(2, 5) });
  }
}

function addSmoke(x, y) {
  G.particles.push({ x: x + rand(-8, 8), y: y + rand(-8, 8), vx: rand(-12, 12), vy: rand(-40, -16), life: rand(0.7, 1.3), max: 1.3, color: '#555', size: rand(5, 9), smoke: true });
}

function addSkid(car) {
  var bx = car.x - Math.cos(car.angle) * car.l / 2;
  var by = car.y - Math.sin(car.angle) * car.l / 2;
  G.skids.push({ x: bx, y: by, angle: car.angle, life: 5 });
  if (G.skids.length > 220) G.skids.shift();
}

function addBulletTracer(x1, y1, x2, y2) {
  G.tracers.push({ x1: x1, y1: y1, x2: x2, y2: y2, life: 0.09 });
}

function updateParticles(dt) {
  for (var i = G.particles.length - 1; i >= 0; i--) {
    var p = G.particles[i];
    p.life -= dt;
    if (p.life <= 0) { G.particles.splice(i, 1); continue; }
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vx *= 0.98; p.vy *= 0.98;
  }
  for (var j = G.tracers.length - 1; j >= 0; j--) {
    G.tracers[j].life -= dt;
    if (G.tracers[j].life <= 0) G.tracers.splice(j, 1);
  }
  for (var k = G.skids.length - 1; k >= 0; k--) {
    G.skids[k].life -= dt;
    if (G.skids[k].life <= 0) G.skids.splice(k, 1);
  }
}

function drawSkids(ctx) {
  ctx.strokeStyle = 'rgba(20,20,20,0.35)';
  ctx.lineWidth = 5;
  for (var i = 0; i < G.skids.length; i++) {
    var s = G.skids[i];
    ctx.globalAlpha = clamp(s.life / 5, 0, 0.6);
    ctx.beginPath();
    ctx.moveTo(s.x - Math.cos(s.angle) * 8, s.y - Math.sin(s.angle) * 8);
    ctx.lineTo(s.x + Math.cos(s.angle) * 8, s.y + Math.sin(s.angle) * 8);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

function drawParticles(ctx) {
  for (var i = 0; i < G.particles.length; i++) {
    var p = G.particles[i];
    ctx.globalAlpha = clamp(p.life / p.max, 0, 1) * (p.smoke ? 0.5 : 1);
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.globalAlpha = 1;
}

function drawTracers(ctx) {
  ctx.strokeStyle = '#ffe08a';
  ctx.lineWidth = 2;
  for (var i = 0; i < G.tracers.length; i++) {
    var t = G.tracers[i];
    ctx.globalAlpha = clamp(t.life / 0.09, 0, 1);
    ctx.beginPath();
    ctx.moveTo(t.x1, t.y1);
    ctx.lineTo(t.x2, t.y2);
    ctx.stroke();
  }
  ctx.globalAlpha = 1;
}

// ---- Pickups and mission markers ----

function drawPickups(ctx) {
  for (var i = 0; i < G.pickups.length; i++) {
    var pk = G.pickups[i];
    var bob = Math.sin(G.time * 3 + i) * 3;
    ctx.save();
    ctx.translate(pk.x, pk.y + bob);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 12, 14, 6, 0, 0, Math.PI * 2); ctx.fill();
    if (pk.kind === 'health') {
      ctx.fillStyle = '#fff';
      ctx.fillRect(-11, -11, 22, 22);
      ctx.fillStyle = '#27ae60';
      ctx.fillRect(-3, -9, 6, 18);
      ctx.fillRect(-9, -3, 18, 6);
    } else {
      ctx.fillStyle = '#f5c542';
      ctx.fillRect(-11, -8, 22, 16);
      ctx.fillStyle = '#1a1a1a';
      ctx.font = 'bold 11px sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('AMMO', 0, 4);
      ctx.textAlign = 'left';
    }
    ctx.restore();
  }
}

function drawMissionMarker(ctx) {
  var pulse = 1 + Math.sin(G.time * 4) * 0.15;
  var drawBeacon = function (x, y, color, label) {
    ctx.save();
    ctx.translate(x, y);
    ctx.strokeStyle = color;
    ctx.lineWidth = 3;
    ctx.globalAlpha = 0.9;
    ctx.beginPath(); ctx.arc(0, 0, 34 * pulse, 0, Math.PI * 2); ctx.stroke();
    ctx.globalAlpha = 0.35;
    ctx.beginPath(); ctx.arc(0, 0, 22 * pulse, 0, Math.PI * 2); ctx.fillStyle = color; ctx.fill();
    ctx.globalAlpha = 1;
    ctx.fillStyle = color;
    ctx.beginPath(); ctx.arc(0, 0, 6, 0, Math.PI * 2); ctx.fill();
    ctx.font = 'bold 13px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillStyle = '#fff';
    ctx.strokeStyle = 'rgba(0,0,0,0.7)';
    ctx.lineWidth = 3;
    ctx.strokeText(label, 0, -44);
    ctx.fillText(label, 0, -44);
    ctx.textAlign = 'left';
    ctx.restore();
  };
  var obj = currentObjective();
  if (obj && obj.pos) {
    drawBeacon(obj.pos.x, obj.pos.y, '#f5c542', obj.step.text);
  } else if (!G.mission && G.missionIndex < MISSIONS.length) {
    var mp = missionMarkerPos();
    drawBeacon(mp.x, mp.y, '#f5c542', 'M — ' + MISSIONS[G.missionIndex].title);
  }
  if (G.fare) {
    var fx = G.fare.state === 'pickup' ? G.fare.px : G.fare.dx;
    var fy = G.fare.state === 'pickup' ? G.fare.py : G.fare.dy;
    drawBeacon(fx, fy, '#7dff8a', G.fare.state === 'pickup' ? 'Passenger' : 'Destination');
  }
  // Landmark icons: spray shop, hospital, gun shop.
  var L = CITY.landmarks;
  drawLandmarkIcon(ctx, L.spray.x, L.spray.y, 'SPRAY', '#ff9ff3');
  drawLandmarkIcon(ctx, L.hospital.x, L.hospital.y, 'CLINIC', '#7dff8a');
  drawLandmarkIcon(ctx, L.gunshop.x, L.gunshop.y, 'ARMS', '#f5c542');
}

// An arrow at the screen edge pointing at an off-screen objective.
function drawOffscreenArrow(ctx) {
  var obj = currentObjective();
  var tx, ty, color;
  if (obj && obj.pos) { tx = obj.pos.x; ty = obj.pos.y; color = '#f5c542'; }
  else if (!G.mission && G.missionIndex < MISSIONS.length) {
    var mp = missionMarkerPos(); tx = mp.x; ty = mp.y; color = '#f5c542';
  } else if (G.fare) {
    tx = G.fare.state === 'pickup' ? G.fare.px : G.fare.dx;
    ty = G.fare.state === 'pickup' ? G.fare.py : G.fare.dy;
    color = '#7dff8a';
  } else return;
  var cam = G.cam;
  var vw = _canvas.width / cam.zoom, vh = _canvas.height / cam.zoom;
  var x0 = cam.x - vw / 2, y0 = cam.y - vh / 2;
  if (tx > x0 + 40 && tx < x0 + vw - 40 && ty > y0 + 40 && ty < y0 + vh - 40) return;
  var cx = clamp(tx, x0 + 50, x0 + vw - 50);
  var cy = clamp(ty, y0 + 50, y0 + vh - 50);
  var a = angleTo(cx, cy, tx, ty);
  ctx.save();
  ctx.translate(cx, cy);
  ctx.rotate(a);
  ctx.fillStyle = color;
  ctx.strokeStyle = 'rgba(0,0,0,0.6)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(18, 0);
  ctx.lineTo(-10, -11);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-10, 11);
  ctx.closePath();
  ctx.fill();
  ctx.stroke();
  ctx.restore();
  var d = Math.round(dist(G.player.x, G.player.y, tx, ty));
  ctx.save();
  ctx.translate(cx, cy);
  ctx.font = 'bold 14px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillStyle = '#fff';
  ctx.strokeStyle = 'rgba(0,0,0,0.8)';
  ctx.lineWidth = 3;
  ctx.strokeText(d + ' m', 0, 30);
  ctx.fillText(d + ' m', 0, 30);
  ctx.textAlign = 'left';
  ctx.restore();
}

function drawLandmarkIcon(ctx, x, y, label, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.fillStyle = color;
  ctx.globalAlpha = 0.85;
  ctx.beginPath(); ctx.arc(0, 0, 10, 0, Math.PI * 2); ctx.fill();
  ctx.globalAlpha = 1;
  ctx.fillStyle = '#111';
  ctx.font = 'bold 9px sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText(label[0], 0, 3);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 11px sans-serif';
  ctx.strokeStyle = 'rgba(0,0,0,0.7)';
  ctx.lineWidth = 3;
  ctx.strokeText(label, 0, -16);
  ctx.fillText(label, 0, -16);
  ctx.textAlign = 'left';
  ctx.restore();
}

// ---- People and cars ----

function drawPeds(ctx, x0, y0, x1, y1) {
  for (var i = 0; i < G.peds.length; i++) {
    var p = G.peds[i];
    if (p.x < x0 || p.x > x1 || p.y < y0 || p.y > y1) continue;
    ctx.save();
    ctx.translate(p.x, p.y);
    if (p.state === 'down') {
      ctx.rotate(1.35);
      ctx.fillStyle = p.color;
      ctx.fillRect(-11, -5, 22, 10);
      ctx.fillStyle = p.skin;
      ctx.beginPath(); ctx.arc(14, 0, 6, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      continue;
    }
    var bob = Math.sin(p.walkPhase) * 2;
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 10, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(p.angle + Math.PI / 2);
    ctx.fillStyle = p.color;
    ctx.fillRect(-6, -8 + bob * 0.3, 12, 16);
    ctx.fillStyle = '#2c3e50';
    ctx.fillRect(-5, 7, 4, 7);
    ctx.fillRect(1, 7, 4, 7);
    ctx.fillStyle = p.skin;
    ctx.beginPath(); ctx.arc(0, -11, 6, 0, Math.PI * 2); ctx.fill();
    if (p.hat) {
      ctx.fillStyle = '#8e44ad';
      ctx.fillRect(-6, -15, 12, 3);
      ctx.fillRect(-4, -19, 8, 4);
    }
    ctx.restore();
  }
}

function drawCarShape(ctx, c) {
  // Shadow.
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 4, c.l / 2 + 2, c.w / 2 + 2, 0, 0, Math.PI * 2); ctx.fill();
  ctx.save();
  ctx.rotate(c.angle);
  var hw = c.w / 2, hl = c.l / 2;
  // Body.
  ctx.fillStyle = c.color;
  roundRect(ctx, -hl, -hw, c.l, c.w, 8);
  ctx.fill();
  // Police livery.
  if (c.isCop) {
    ctx.fillStyle = '#111';
    ctx.fillRect(-hl * 0.35, -hw, hl * 0.7, c.w);
    ctx.fillStyle = '#f5f5f5';
    ctx.fillRect(-hl * 0.1, -hw, hl * 0.2, c.w);
    // Light bar: flashing red/blue.
    var flash = Math.floor(G.time * 6) % 2 === 0;
    ctx.fillStyle = flash ? '#ff2d2d' : '#2d7bff';
    ctx.fillRect(-6, -hw + 2, 12, 6);
    ctx.fillStyle = flash ? '#2d7bff' : '#ff2d2d';
    ctx.fillRect(-6, hw - 8, 12, 6);
  }
  if (c.name === 'Taxi') {
    ctx.fillStyle = '#111';
    ctx.font = 'bold 8px sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText('TAXI', 0, 3);
    ctx.textAlign = 'left';
  }
  // Windshield + roof + rear window.
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  roundRect(ctx, hl * 0.28, -hw + 4, hl * 0.22, c.w - 8, 3);
  ctx.fill();
  ctx.fillStyle = shadeColor(c.color, -22);
  roundRect(ctx, -hl * 0.18, -hw + 3, hl * 0.36, c.w - 6, 4);
  ctx.fill();
  ctx.fillStyle = 'rgba(20,30,44,0.85)';
  roundRect(ctx, -hl * 0.5, -hw + 4, hl * 0.2, c.w - 8, 3);
  ctx.fill();
  // Headlights and taillights.
  ctx.fillStyle = '#ffeeb0';
  ctx.fillRect(hl - 2, -hw + 4, 3, 6);
  ctx.fillRect(hl - 2, hw - 10, 3, 6);
  ctx.fillStyle = '#ff3b30';
  ctx.fillRect(-hl - 1, -hw + 4, 3, 6);
  ctx.fillRect(-hl - 1, hw - 10, 3, 6);
  // Damage smoke puff position is handled by particles.
  ctx.restore();
  // Health bar over a damaged car.
  if (c.health < 70 && !c.parked) {
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(c.x - 18, c.y - c.w / 2 - 14, 36, 5);
    ctx.fillStyle = c.health > 35 ? '#f5a623' : '#e74c3c';
    ctx.fillRect(c.x - 18, c.y - c.w / 2 - 14, 36 * (c.health / 100), 5);
  }
}

function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function drawCars(ctx, x0, y0, x1, y1) {
  for (var i = 0; i < G.cars.length; i++) {
    var c = G.cars[i];
    if (c.x < x0 || c.x > x1 || c.y < y0 || c.y > y1) continue;
    ctx.save();
    ctx.translate(c.x, c.y);
    drawCarShape(ctx, c);
    ctx.restore();
  }
  // Foot cops: dark-blue uniforms with a badge dot.
  for (var j = 0; j < G.cops.length; j++) {
    var cop = G.cops[j];
    if (!cop.onFoot) continue;
    if (cop.x < x0 || cop.x > x1 || cop.y < y0 || cop.y > y1) continue;
    ctx.save();
    ctx.translate(cop.x, cop.y);
    ctx.fillStyle = 'rgba(0,0,0,0.25)';
    ctx.beginPath(); ctx.ellipse(0, 10, 9, 4, 0, 0, Math.PI * 2); ctx.fill();
    ctx.rotate(cop.angle + Math.PI / 2);
    ctx.fillStyle = '#1f3a93';
    ctx.fillRect(-6, -8, 12, 16);
    ctx.fillStyle = '#f5c542';
    ctx.fillRect(-2, -4, 4, 4);
    ctx.fillStyle = '#f1c27d';
    ctx.beginPath(); ctx.arc(0, -11, 6, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#1f3a93';
    ctx.fillRect(-6, -16, 12, 4);
    ctx.restore();
  }
}

function drawPlayer(ctx) {
  var p = G.player;
  if (p.inCar) return; // the car is drawn instead
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.fillStyle = 'rgba(0,0,0,0.3)';
  ctx.beginPath(); ctx.ellipse(2, 10, 11, 5, 0, 0, Math.PI * 2); ctx.fill();
  ctx.rotate(p.angle + Math.PI / 2);
  var bob = p.moving ? Math.sin(p.walkPhase) * 2 : 0;
  // Legs.
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(-5, 6 + bob, 4, 8);
  ctx.fillRect(1, 6 - bob, 4, 8);
  // Teal jacket — Riko's signature colour.
  ctx.fillStyle = '#0e7c7b';
  ctx.fillRect(-7, -8, 14, 15);
  ctx.fillStyle = '#0a5e5d';
  ctx.fillRect(-7, -8, 14, 4);
  // Head + hair.
  ctx.fillStyle = '#e0ac69';
  ctx.beginPath(); ctx.arc(0, -12, 6.5, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#1a1a1a';
  ctx.beginPath(); ctx.arc(0, -13, 6.5, Math.PI, Math.PI * 2); ctx.fill();
  // Pistol in hand when armed.
  if (p.weapon === 'pistol') {
    ctx.fillStyle = '#222';
    ctx.fillRect(4, -14, 12, 3);
    if (p.muzzleT > 0) {
      ctx.fillStyle = '#ffe08a';
      ctx.beginPath(); ctx.arc(18, -13, 7, 0, Math.PI * 2); ctx.fill();
    }
  }
  ctx.restore();
}

function drawDayTint(ctx, x0, y0, x1, y1) {
  var dl = daylight();
  if (dl >= 0.95) return;
  // Warm sunset, cold night: one translucent wash over the world.
  var mins = G.clockMinutes % 1440;
  var color;
  if (mins >= 1020 && mins < 1260) color = 'rgba(255,120,40,' + (0.34 * (1 - dl)) + ')';
  else color = 'rgba(10,16,60,' + (0.55 * (1 - dl)) + ')';
  ctx.fillStyle = color;
  ctx.fillRect(x0, y0, x1 - x0, y1 - y0);
  // Night headlights: a soft cone ahead of every moving car.
  if (isNight()) {
    for (var i = 0; i < G.cars.length; i++) {
      var c = G.cars[i];
      if (Math.abs(c.speed) < 20) continue;
      var grad = ctx.createRadialGradient(c.x + Math.cos(c.angle) * 60, c.y + Math.sin(c.angle) * 60, 6,
        c.x + Math.cos(c.angle) * 60, c.y + Math.sin(c.angle) * 60, 110);
      grad.addColorStop(0, 'rgba(255,240,180,0.20)');
      grad.addColorStop(1, 'rgba(255,240,180,0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(c.x + Math.cos(c.angle) * 60, c.y + Math.sin(c.angle) * 60, 110, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}
