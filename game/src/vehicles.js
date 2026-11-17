// VELMARA: Streets of Gold — vehicles: traffic, the player's car, stealing.
// Traffic cars drive the road graph, keep their lane, and brake for the car ahead.
// The player steals cars with E; a stolen occupied car raises the wanted level.
'use strict';

var TRAFFIC_COUNT = 16;

function makeCar(modelIdx, x, y, angle, color) {
  var m = CAR_MODELS[modelIdx];
  return {
    model: modelIdx,
    name: m.name,
    w: m.w, l: m.l,
    top: m.top, acc: m.acc, grip: m.grip,
    x: x, y: y, angle: angle,
    speed: 0,
    color: color || pick(m.colors),
    driver: true,      // an occupied car has a driver who flees when stolen
    parked: false,
    health: 100,
    smoke: 0,
    // traffic AI
    from: null, to: null, progress: 0, cruise: rand(150, 240),
    brake: 0,
    isPlayer: false,
    isCop: false,
    skid: 0
  };
}

// Spawn traffic across the city, each on a road heading to the next intersection.
function spawnTraffic() {
  var cars = [];
  for (var i = 0; i < TRAFFIC_COUNT; i++) {
    var spot = randomIntersection();
    var model = weightedPick([[0, 5], [1, 4], [2, 1], [3, 2], [4, 2]]);
    var c = makeCar(model, spot.x, spot.y, rand(0, Math.PI * 2));
    // Put the car on a road edge leaving the intersection.
    var dir = pick(['n', 's', 'e', 'w']);
    if (dir === 'n') { c.y = spot.y - 90; c.angle = -Math.PI / 2; }
    if (dir === 's') { c.y = spot.y + 90; c.angle = Math.PI / 2; }
    if (dir === 'e') { c.x = spot.x + 90; c.angle = 0; }
    if (dir === 'w') { c.x = spot.x - 90; c.angle = Math.PI; }
    c.from = { x: spot.x, y: spot.y };
    c.to = pickNextNode(c.from, c.angle);
    c.progress = 0;
    c.speed = rand(120, 200);
    cars.push(c);
  }
  // A few parked cars along the curbs for the player to steal quietly.
  // Parked on the street itself (on the street centre line), clear of buildings,
  // facing along the street so they drive away cleanly.
  for (var j = 0; j < 7; j++) {
    var pspot = randomIntersection();
    var pmodel = weightedPick([[0, 4], [1, 4], [2, 2], [3, 1]]);
    var pc = makeCar(pmodel, pspot.x + pick([-1, 1]) * (ROAD_W / 2 - 10), pspot.y, chance(0.5) ? 0 : Math.PI);
    pc.parked = true;
    pc.driver = false;
    pc.speed = 0;
    cars.push(pc);
  }
  return cars;
}

// Cars are long: test two circles (front and rear axle) against buildings so a
// car can use the full road width without its nose clipping a wall.
function collideCarBuildings(c) {
  var hit = false;
  var r = c.w / 2 + 2;
  for (var s = -1; s <= 1; s += 2) {
    var px = c.x + Math.cos(c.angle) * (c.l / 4) * s;
    var py = c.y + Math.sin(c.angle) * (c.l / 4) * s;
    var probe = { x: px, y: py };
    if (collideCircleBuildings(probe, r)) {
      c.x += probe.x - px;
      c.y += probe.y - py;
      hit = true;
    }
  }
  return hit;
}

// The next intersection from `node`, continuing roughly along `angle`.
function pickNextNode(node, angle) {
  var best = null, bestScore = -1e18;
  var all = intersections();
  for (var i = 0; i < all.length; i++) {
    var n = all[i];
    if (n.x === node.x && n.y === node.y) continue;
    // Neighbours only: same avenue or same street, one block away.
    var sameAve = n.x === node.x && Math.abs(n.y - node.y) <= 300;
    var sameSt = n.y === node.y && Math.abs(n.x - node.x) <= 340;
    if (!sameAve && !sameSt) continue;
    var a = angleTo(node.x, node.y, n.x, n.y);
    var score = Math.cos(angleDiff(angle, a)) * 2 + Math.random() * 0.8;
    if (score > bestScore) { bestScore = score; best = n; }
  }
  if (!best) best = randomIntersection();
  return best;
}

// Drive one traffic car along its edge, braking for the car ahead.
function updateTrafficCar(c, dt) {
  if (c.isPlayer || c.isCop) return;
  if (c.parked) return;
  if (!c.to) { c.to = pickNextNode(c.from || { x: c.x, y: c.y }, c.angle); }
  var tx = c.to.x, ty = c.to.y;
  // Lane offset: drive on the right side of the road.
  var a = angleTo(c.x, c.y, tx, ty);
  var laneX = tx + Math.cos(a + Math.PI / 2) * 12;
  var laneY = ty + Math.sin(a + Math.PI / 2) * 12;
  var targetAngle = Math.atan2(laneY - c.y, laneX - c.x);
  var diff = angleDiff(c.angle, targetAngle);
  c.angle += clamp(diff, -2.2 * dt, 2.2 * dt);
  // Brake if another car is close ahead.
  var ahead = 0;
  for (var i = 0; i < G.cars.length; i++) {
    var o = G.cars[i];
    if (o === c || o.parked) continue;
    var d = dist(c.x, c.y, o.x, o.y);
    if (d < 90) {
      var oa = angleTo(c.x, c.y, o.x, o.y);
      if (Math.abs(angleDiff(c.angle, oa)) < 0.6) ahead = Math.max(ahead, 1 - d / 90);
    }
  }
  var want = c.cruise * (1 - ahead * 0.9);
  if (c.speed < want) c.speed = Math.min(want, c.speed + 160 * dt);
  else c.speed = Math.max(want, c.speed - 320 * dt);
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  // Reached the node: pick the next one.
  if (dist(c.x, c.y, tx, ty) < 26) {
    c.from = { x: tx, y: ty };
    c.to = pickNextNode(c.from, c.angle);
  }
  // Keep off buildings and out of the water.
  if (collideCarBuildings(c)) c.speed *= 0.5;
  if (c.y > WATER_Y - 20) { c.y = WATER_Y - 20; c.angle = -c.angle; }
  clampToWorld(c, 40);
}

// ---- Player driving ----

function updatePlayerCar(dt) {
  var c = G.playerCar;
  if (!c) return;
  var mv = moveVector();
  var throttle = 0;
  if (mv.y < 0) throttle = 1;          // W: accelerate
  if (mv.y > 0) throttle = -0.7;       // S: brake / reverse
  var steer = 0;
  if (mv.x < 0) steer = -1;
  if (mv.x > 0) steer = 1;
  var dir = c.speed >= 0 ? 1 : -1;
  // Steering tightens with grip and eases at speed.
  var steerRate = c.grip * (1 - Math.min(0.55, Math.abs(c.speed) / c.top * 0.55));
  c.angle += steer * steerRate * dt * dir * clamp(Math.abs(c.speed) / 60, 0.25, 1);
  if (throttle > 0) c.speed = Math.min(c.top, c.speed + c.acc * dt);
  else if (throttle < 0) c.speed = Math.max(-c.top * 0.45, c.speed + c.acc * throttle * dt);
  else {
    // Coast down.
    c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 140 * dt);
  }
  if (keyDown('Shift')) {
    // Handbrake: sharp decel, skid marks, tighter turn.
    c.speed -= Math.sign(c.speed) * Math.min(Math.abs(c.speed), 420 * dt);
    c.angle += steer * 1.4 * dt * dir;
    if (Math.abs(c.speed) > 120 && Math.random() < 0.5) addSkid(c);
    if (Math.random() < 0.3) sfxSkid();
  }
  var nx = c.x + Math.cos(c.angle) * c.speed * dt;
  var ny = c.y + Math.sin(c.angle) * c.speed * dt;
  c.x = nx;
  c.y = ny;
  var speedBefore = c.speed;
  if (collideCarBuildings(c)) {
    // Hit a wall: bounce a little, take damage, make noise.
    if (Math.abs(speedBefore) > 140) {
      sfxCrash();
      addParticles(c.x, c.y, 8, '#f1c40f');
      damageCar(c, Math.abs(speedBefore) * 0.06);
      addShake(Math.min(9, Math.abs(speedBefore) * 0.02));
    }
    c.speed *= -0.25;
  }
  if (c.y > WATER_Y - 20) { c.y = WATER_Y - 20; c.speed *= -0.3; }
  clampToWorld(c, 40);
  // Smoke when damaged.
  if (c.health < 45) {
    c.smoke += dt;
    if (c.smoke > 0.12) { c.smoke = 0; addSmoke(c.x, c.y); }
  }
  if (c.health <= 0) {
    explodeCar(c);
    exitCar(true);
    return;
  }
  // Sync the player to the car.
  G.player.x = c.x;
  G.player.y = c.y;
  G.player.angle = c.angle;
}

function damageCar(c, amount) {
  c.health = Math.max(0, c.health - amount);
}

function explodeCar(c) {
  addParticles(c.x, c.y, 40, '#ff7b2f');
  addParticles(c.x, c.y, 24, '#3a3f46');
  sfxCrash();
  addShake(14);
  addHeat(8, 'car explosion');
  c.health = 0;
  c.parked = true;
  c.speed = 0;
}

// Car-vs-car: push apart and trade a little speed; hard hits damage both.
function collideCars(dt) {
  var cars = G.cars;
  for (var i = 0; i < cars.length; i++) {
    for (var j = i + 1; j < cars.length; j++) {
      var a = cars[i], b = cars[j];
      if (a.parked && b.parked) continue;
      var dx = b.x - a.x, dy = b.y - a.y;
      var d = Math.sqrt(dx * dx + dy * dy);
      var min = (a.l + b.l) / 2 - 14;
      if (d > 0.01 && d < min) {
        var push = (min - d) / 2;
        var ux = dx / d, uy = dy / d;
        a.x -= ux * push; a.y -= uy * push;
        b.x += ux * push; b.y += uy * push;
        var rel = Math.abs(a.speed - b.speed);
        if (rel > 120) {
          if (Math.random() < 0.4) sfxCrash();
          damageCar(a, rel * 0.02);
          damageCar(b, rel * 0.02);
          if (a.isPlayer || b.isPlayer) addShake(4);
        }
        var avg = (a.speed + b.speed) / 2;
        a.speed = avg; b.speed = avg;
      }
    }
  }
}

// The player car runs over pedestrians.
function carHitPeds() {
  var c = G.playerCar;
  if (!c || Math.abs(c.speed) < 60) return;
  for (var i = 0; i < G.peds.length; i++) {
    var p = G.peds[i];
    if (p.state === 'down') continue;
    if (dist(p.x, p.y, c.x, c.y) < c.l / 2 + 8) pedHitByCar(p, c);
  }
}

// Nearest car the player could enter (within reach, roughly stopped or slow).
function nearestEnterableCar() {
  var best = null, bd = 1e18;
  for (var i = 0; i < G.cars.length; i++) {
    var c = G.cars[i];
    if (c.isCop && c.speed > 40) continue;
    var d = dist(G.player.x, G.player.y, c.x, c.y);
    if (d < 58 && d < bd) { bd = d; best = c; }
  }
  return best;
}

function enterCar(c) {
  if (!c) return false;
  if (c.driver) {
    // Stealing an occupied car: the driver bails and the law notices.
    c.driver = false;
    var d = makePed(false);
    d.x = c.x + 40; d.y = c.y + 20;
    d.state = 'flee'; d.stateT = 3;
    d.tx = d.x + 200; d.ty = d.y + 100;
    G.peds.push(d);
    addHeat(10, 'car stolen');
    showToast('Car stolen! The Velmara police are on their way.');
  }
  c.parked = false;
  c.isPlayer = true;
  G.playerCar = c;
  G.player.inCar = true;
  sfxEnterCar();
  return true;
}

function exitCar(wrecked) {
  var c = G.playerCar;
  if (!c) return;
  c.isPlayer = false;
  if (!wrecked) {
    c.speed = 0;
    c.parked = true;
  }
  G.playerCar = null;
  G.player.inCar = false;
  // Step out to the side of the car.
  G.player.x = c.x + Math.cos(c.angle + Math.PI / 2) * 30;
  G.player.y = c.y + Math.sin(c.angle + Math.PI / 2) * 30;
  collideCircleBuildings(G.player, PLAYER_RADIUS);
  clampToWorld(G.player, 20);
}

// Keep traffic topped up near the player.
function maintainTraffic() {
  var px = G.player.x, py = G.player.y;
  var near = 0;
  for (var i = 0; i < G.cars.length; i++) {
    if (!G.cars[i].isPlayer && !G.cars[i].isCop && dist(G.cars[i].x, G.cars[i].y, px, py) < 1100) near++;
  }
  if (near < 9) {
    var spot = nearestIntersection(px + rand(-500, 500), py + rand(-500, 500));
    var model = weightedPick([[0, 5], [1, 4], [2, 1], [3, 2], [4, 2]]);
    var c = makeCar(model, spot.x, spot.y, rand(0, Math.PI * 2));
    c.from = { x: spot.x, y: spot.y };
    c.to = pickNextNode(c.from, c.angle);
    c.speed = rand(120, 200);
    G.cars.push(c);
  }
  // Remove traffic that drifted far away (never the player's car or cops).
  for (var j = G.cars.length - 1; j >= 0; j--) {
    var o = G.cars[j];
    if (!o.isPlayer && !o.isCop && !o.parked && dist(o.x, o.y, px, py) > 1800) G.cars.splice(j, 1);
  }
}
