// VELMARA: Streets of Gold — pedestrians.
// Velmara's people walk the sidewalks, cross at corners, chat, and run when
// gunfire, crashes or sirens come too close.
'use strict';

var PED_COUNT = 26;

function spawnPeds() {
  var peds = [];
  for (var i = 0; i < PED_COUNT; i++) {
    var p = makePed(true);
    peds.push(p);
  }
  return peds;
}

function makePed(anywhere) {
  var spot = randomIntersection();
  var x = spot.x, y = spot.y;
  if (!anywhere) {
    // Spawn near the player, on a sidewalk.
    var near = nearestIntersection(G.player.x, G.player.y);
    x = near.x + rand(-160, 160);
    y = near.y + rand(-160, 160);
  }
  return {
    x: clamp(x, 60, WORLD_W - 60),
    y: clamp(y, 60, SAND_TOP - 30),
    tx: x, ty: y,            // current walk target
    speed: rand(38, 68),
    color: pick(PED_COLORS),
    skin: pick(['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#ffdbac']),
    hat: chance(0.25),
    angle: rand(0, Math.PI * 2),
    walkPhase: rand(0, Math.PI * 2),
    state: 'walk',           // walk | flee | down
    stateT: 0,
    vx: 0, vy: 0
  };
}

// Pick a new sidewalk waypoint: a nearby intersection, offset onto the sidewalk.
function pedNewTarget(p) {
  var spot = randomIntersection();
  var dx = spot.x - p.x, dy = spot.y - p.y;
  if (Math.abs(dx) > Math.abs(dy)) {
    p.tx = spot.x;
    p.ty = spot.y + (chance(0.5) ? 1 : -1) * (STREET_W / 2 + 8);
  } else {
    p.tx = spot.x + (chance(0.5) ? 1 : -1) * (ROAD_W / 2 + 8);
    p.ty = spot.y;
  }
  p.tx = clamp(p.tx, 40, WORLD_W - 40);
  p.ty = clamp(p.ty, 40, SAND_TOP - 20);
}

function pedScare(p, x, y, radius) {
  if (dist(p.x, p.y, x, y) < radius && p.state !== 'down') {
    p.state = 'flee';
    p.stateT = rand(1.5, 3);
    var a = angleTo(x, y, p.x, p.y) + rand(-0.6, 0.6);
    p.tx = p.x + Math.cos(a) * rand(180, 320);
    p.ty = p.y + Math.sin(a) * rand(180, 320);
    p.tx = clamp(p.tx, 40, WORLD_W - 40);
    p.ty = clamp(p.ty, 40, SAND_TOP - 20);
  }
}

function updatePeds(dt) {
  var peds = G.peds;
  for (var i = 0; i < peds.length; i++) {
    var p = peds[i];
    if (p.state === 'down') {
      p.stateT -= dt;
      if (p.stateT <= 0) { p.state = 'walk'; pedNewTarget(p); }
      continue;
    }
    var speed = p.speed * (p.state === 'flee' ? 2.4 : 1);
    var d = dist(p.x, p.y, p.tx, p.ty);
    if (d < 14) {
      if (p.state === 'flee') { p.state = 'walk'; p.stateT = 0; }
      pedNewTarget(p);
    } else {
      var a = angleTo(p.x, p.y, p.tx, p.ty);
      p.angle = a;
      p.x += Math.cos(a) * speed * dt;
      p.y += Math.sin(a) * speed * dt;
      p.walkPhase += dt * speed * 0.12;
    }
    if (p.state === 'flee') {
      p.stateT -= dt;
      if (p.stateT <= 0) p.state = 'walk';
    }
    // Stay out of buildings and water.
    collideCircleBuildings(p, 10);
    if (p.y > SAND_TOP - 12) p.y = SAND_TOP - 12;
    clampToWorld(p, 30);
  }
}

// A car hit a pedestrian: knock them down, count the crime.
function pedHitByCar(p, car) {
  if (p.state === 'down') return;
  p.state = 'down';
  p.stateT = rand(2.5, 4);
  var a = Math.atan2(p.y - car.y, p.x - car.x);
  p.x += Math.cos(a) * 26;
  p.y += Math.sin(a) * 26;
  addHeat(14, 'pedestrian hit');
  addParticles(p.x, p.y, 10, '#e74c3c');
  sfxPunch();
}

// Keep the streets populated: replace peds that wandered too far away.
function maintainPeds() {
  var px = G.player.x, py = G.player.y;
  var far = 0;
  for (var i = 0; i < G.peds.length; i++) {
    if (dist(G.peds[i].x, G.peds[i].y, px, py) > 1500) far++;
  }
  if (far > 6) {
    for (var j = 0; j < G.peds.length; j++) {
      if (dist(G.peds[j].x, G.peds[j].y, px, py) > 1500) {
        G.peds[j] = makePed(false);
        break;
      }
    }
  }
}

// Scare every ped near a gunshot or a crash.
function scareNearbyPeds(x, y, radius) {
  for (var i = 0; i < G.peds.length; i++) pedScare(G.peds[i], x, y, radius);
}
