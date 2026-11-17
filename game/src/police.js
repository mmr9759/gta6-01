// VELMARA: Streets of Gold — the wanted level and the Velmara police.
// Heat rises with every crime; stars follow. Cop cars chase and ram, foot cops
// chase and arrest, and at three stars and up they start shooting back.
'use strict';

var COP_CAR_MODEL = 5;

function wantedStars() {
  if (G.heat <= 0) return 0;
  return Math.min(MAX_STARS, Math.ceil(G.heat / HEAT_PER_STAR));
}

function addHeat(amount, reason) {
  G.heat = clamp(G.heat + amount, 0, 100);
  G.lastCrimeT = G.time;
  if (G.debugWanted) console.log('[wanted] +' + amount + ' ' + reason + ' -> heat ' + G.heat);
}

function clearWanted() {
  G.heat = 0;
  // Cops give up and drive off.
  for (var i = G.cops.length - 1; i >= 0; i--) {
    var c = G.cops[i];
    if (c.car) { c.car.isCop = false; c.car.parked = true; c.car.speed = 0; }
    G.cops.splice(i, 1);
  }
  for (var j = G.cars.length - 1; j >= 0; j--) {
    if (G.cars[j].isCop) { G.cars[j].isCop = false; G.cars[j].parked = true; G.cars[j].speed = 0; }
  }
}

// How many cop cars the current stars call for.
function wantedCopCars() {
  var s = wantedStars();
  if (s === 0) return 0;
  return Math.min(1 + s, 5);
}

// How many foot cops the current stars call for (only when the player is on foot).
function wantedFootCops() {
  var s = wantedStars();
  if (s < 2 || G.player.inCar) return 0;
  return Math.min(s - 1, 3);
}

function spawnCopCar() {
  var p = G.player;
  // Spawn on a road a little way from the player, in view but not on top of them.
  var spot = nearestIntersection(p.x + pick([-1, 1]) * rand(420, 620), p.y + pick([-1, 1]) * rand(300, 520));
  var c = makeCar(COP_CAR_MODEL, spot.x, spot.y, angleTo(spot.x, spot.y, p.x, p.y));
  c.isCop = true;
  c.driver = true;
  c.parked = false;
  c.speed = 200;
  G.cars.push(c);
  var cop = { car: c, x: c.x, y: c.y, angle: c.angle, health: 100, onFoot: false, arrestT: 0, shootT: rand(0.5, 1.5), sirenT: 0 };
  G.cops.push(cop);
  return cop;
}

function spawnFootCop() {
  var p = G.player;
  var spot = nearestIntersection(p.x + pick([-1, 1]) * rand(200, 380), p.y + pick([-1, 1]) * rand(160, 300));
  var cop = {
    car: null, x: spot.x, y: spot.y, angle: angleTo(spot.x, spot.y, p.x, p.y),
    health: 50, onFoot: true, arrestT: 0, shootT: rand(0.8, 2), sirenT: 0, speed: 210
  };
  G.cops.push(cop);
  return cop;
}

// A cop car chases the player: steer toward a point ahead of them, ram to stop them.
function updateCopCar(cop, dt) {
  var c = cop.car;
  var p = G.player;
  var px = p.x, py = p.y;
  if (G.playerCar) {
    // Lead the target a little.
    px += (G.playerCar.speed * 0.35) * Math.cos(G.playerCar.angle);
    py += (G.playerCar.speed * 0.35) * Math.sin(G.playerCar.angle);
  }
  var targetAngle = angleTo(c.x, c.y, px, py);
  var diff = angleDiff(c.angle, targetAngle);
  var steerRate = 3.1 * (1 - Math.min(0.5, Math.abs(c.speed) / c.top * 0.5));
  c.angle += clamp(diff, -steerRate * dt, steerRate * dt);
  var d = dist(c.x, c.y, p.x, p.y);
  var want = d > 260 ? c.top : (d > 90 ? c.top * 0.75 : c.top * 0.4);
  if (c.speed < want) c.speed = Math.min(want, c.speed + c.acc * dt);
  else c.speed = Math.max(want, c.speed - 300 * dt);
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  if (collideCarBuildings(c)) { c.speed *= 0.4; }
  if (c.y > WATER_Y - 20) { c.y = WATER_Y - 20; c.angle = -c.angle; }
  clampToWorld(c, 40);
  cop.x = c.x; cop.y = c.y; cop.angle = c.angle;
  // Ram damage to the player's car.
  if (G.playerCar && dist(c.x, c.y, G.playerCar.x, G.playerCar.y) < (c.l + G.playerCar.l) / 2 - 10) {
    if (Math.abs(c.speed) > 150) {
      damageCar(G.playerCar, 6 * dt);
      addShake(3);
      if (Math.random() < dt * 2) sfxCrash();
    }
  }
  // A cop car that touches the player on foot knocks them down and arrests them.
  if (!G.player.inCar && dist(c.x, c.y, p.x, p.y) < 34) {
    cop.arrestT += dt;
    if (cop.arrestT > 1.2) busted('The Velmara police dragged you out of the street.');
  } else {
    cop.arrestT = 0;
  }
}

// A foot cop runs the player down; at three stars they shoot when close.
function updateFootCop(cop, dt) {
  var p = G.player;
  var d = dist(cop.x, cop.y, p.x, p.y);
  if (p.inCar) {
    // The player drove off: the cop gives up and heads for the nearest road.
    var spot = nearestIntersection(cop.x, cop.y);
    var a = angleTo(cop.x, cop.y, spot.x, spot.y);
    cop.x += Math.cos(a) * cop.speed * dt * 0.6;
    cop.y += Math.sin(a) * cop.speed * dt * 0.6;
    cop.angle = a;
    if (dist(cop.x, cop.y, spot.x, spot.y) < 30) cop.done = true;
    return;
  }
  var ta = angleTo(cop.x, cop.y, p.x, p.y);
  cop.angle = ta;
  var speed = cop.speed;
  if (d > 300) speed *= 0.7; // they lose the trail at range
  cop.x += Math.cos(ta) * speed * dt;
  cop.y += Math.sin(ta) * speed * dt;
  collideCircleBuildings(cop, 12);
  if (d < 30) {
    cop.arrestT += dt;
    if (cop.arrestT > 1.2) busted('Busted! A Velmara officer cuffed you on the spot.');
  } else {
    cop.arrestT = Math.max(0, cop.arrestT - dt * 2);
  }
  // Shooting: three stars and up, in range, with a wind-up between shots.
  if (wantedStars() >= 3 && d < 340 && d > 60) {
    cop.shootT -= dt;
    if (cop.shootT <= 0) {
      cop.shootT = rand(0.9, 1.6);
      copShoot(cop, p);
    }
  }
}

function copShoot(cop, p) {
  // Cops are bad shots on purpose: the player can dodge at range.
  var a = angleTo(cop.x, cop.y, p.x, p.y) + rand(-0.22, 0.22);
  addBulletTracer(cop.x, cop.y, p.x + Math.cos(a) * 60, p.y + Math.sin(a) * 60);
  sfxShoot();
  if (Math.random() < 0.3) damagePlayer(rand(5, 9), 'shot by police');
}

function damageCop(cop, amount) {
  cop.health -= amount;
  addParticles(cop.x, cop.y, 6, '#e74c3c');
  if (cop.health <= 0) {
    addHeat(18, 'officer down');
    addParticles(cop.x, cop.y, 16, '#e74c3c');
    showToast('An officer is down — the whole city will hear about this.');
    if (cop.car) {
      cop.car.isCop = false;
      cop.car.parked = true;
      cop.car.speed = 0;
      cop.car.health = 40;
    }
    cop.dead = true;
    sfxCrash();
  }
}

// Keep the police presence matched to the wanted level; decay heat when quiet.
function updatePolice(dt) {
  var p = G.player;
  // Heat decays when no crime has happened for a while.
  if (G.time - G.lastCrimeT > 8 && G.heat > 0) {
    G.heat = Math.max(0, G.heat - 1.6 * dt);
  }
  // Spawn what the stars demand.
  var wantCars = wantedCopCars();
  var haveCars = 0;
  for (var i = 0; i < G.cops.length; i++) if (!G.cops[i].onFoot && !G.cops[i].dead) haveCars++;
  if (haveCars < wantCars && Math.random() < dt * 1.2) spawnCopCar();
  var wantFoot = wantedFootCops();
  var haveFoot = 0;
  for (var j = 0; j < G.cops.length; j++) if (G.cops[j].onFoot && !G.cops[j].dead) haveFoot++;
  if (haveFoot < wantFoot && Math.random() < dt * 1.0) spawnFootCop();

  for (var k = G.cops.length - 1; k >= 0; k--) {
    var cop = G.cops[k];
    if (cop.dead) { G.cops.splice(k, 1); continue; }
    if (wantedStars() === 0) {
      // No heat: the cop gives up and walks away.
      cop.done = true;
    }
    if (cop.onFoot) updateFootCop(cop, dt);
    else updateCopCar(cop, dt);
    // A cop too far from the action despawns quietly.
    if (dist(cop.x, cop.y, p.x, p.y) > 1900) {
      if (cop.car) { cop.car.isCop = false; }
      G.cops.splice(k, 1);
      continue;
    }
    if (cop.done) {
      if (cop.car) { cop.car.isCop = false; cop.car.parked = true; cop.car.speed = 0; }
      G.cops.splice(k, 1);
    }
  }
}

// Distance to the nearest cop, for the siren volume.
function nearestCopDist() {
  var best = 1e9;
  for (var i = 0; i < G.cops.length; i++) {
    var d = dist(G.cops[i].x, G.cops[i].y, G.player.x, G.player.y);
    if (d < best) best = d;
  }
  return best;
}
