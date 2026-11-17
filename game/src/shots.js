// VELMARA: Streets of Gold — screenshot staging for the dossier.
// ?shot=1..4 starts the game straight into a staged, real scene (the game itself
// plays: traffic drives, cops chase, the HUD and minimap render). The shots are
// real renders of the game's own code, never edited or composited.
'use strict';

function shotParam() {
  var m = window.location.search.match(/[?&]shot=(\d)/);
  return m ? parseInt(m[1], 10) : 0;
}

// Stage one of the four dossier scenes. Runs before the first frame.
function stageShot(n) {
  var L = CITY.landmarks;
  var p = G.player;
  G.state = 'playing';
  G.shotMode = n;
  G.shotT = 0;
  hideTitleForShot();

  if (n === 1) {
    // COVER: a gold-run chase downtown at golden hour — sports car, 3 stars, cops behind.
    G.clockMinutes = 18 * 60 + 5;
    var car = makeCar(2, 1520, 1320, 0, '#d4af37');
    car.isPlayer = true;
    car.speed = 330;
    G.cars.push(car);
    G.playerCar = car;
    p.inCar = true;
    p.x = car.x; p.y = car.y;
    G.heat = 62;
    G.player.cash = 2850;
    G.missionIndex = 4;
    startMission(4);
    G.mission.step = 1;
    G.mission.stepT = 170;
    spawnCopCar(); spawnCopCar();
    G.cops[0].car.x = car.x - 260; G.cops[0].car.y = car.y + 60;
    G.cops[1].car.x = car.x - 320; G.cops[1].car.y = car.y - 80;
    G.autoDrive = true;
  } else if (n === 2) {
    // On foot at the marina promenade, morning: peds, traffic, the city waking up.
    G.clockMinutes = 9 * 60 + 12;
    p.x = 2480; p.y = 2100;
    p.angle = Math.PI / 2;
    p.weapon = 'pistol';
    p.ammo = 24;
    G.player.cash = 640;
    G.missionIndex = 0;
    G.mission = null;
    G.heat = 0;
    G.autoDrive = false;
  } else if (n === 3) {
    // Dusk at the docks: the Harbor Lights meet, two stars, a patrol closing in.
    G.clockMinutes = 19 * 60 + 24;
    p.x = 2800; p.y = 2240;
    p.angle = -Math.PI / 2;
    p.weapon = 'pistol';
    p.ammo = 18;
    p.health = 78;
    G.player.cash = 1420;
    G.missionIndex = 2;
    startMission(2);
    G.heat = 34;
    spawnCopCar();
    G.cops[0].car.x = 2560; G.cops[0].car.y = 2160;
    G.autoDrive = false;
  } else {
    // Golden hour on the coastal road: taxi fare, palms, traffic, one star.
    G.clockMinutes = 18 * 60 + 5;
    var taxi = makeCar(4, 880, 2160, 0, '#f7c948');
    taxi.isPlayer = true;
    taxi.speed = 300;
    G.cars.push(taxi);
    G.playerCar = taxi;
    p.inCar = true;
    p.x = taxi.x; p.y = taxi.y;
    G.heat = 12;
    G.player.cash = 1730;
    G.fare = { px: 1200, py: 2160, dx: 2480, dy: 1880, fare: 55, state: 'dropoff', t: 120 };
    G.missionIndex = 5;
    G.mission = null;
    spawnCopCar();
    G.cops[0].car.x = taxi.x - 380; G.cops[0].car.y = taxi.y + 40;
    G.autoDrive = true;
  }
  G.cam.x = p.x;
  G.cam.y = p.y;
  updateObjectiveHUD();
  updateStatsHUD();
  // The shot is ready once the scene has lived a little (traffic moves, cops close in).
  window.__shotReady = false;
  setTimeout(function () { window.__shotReady = true; }, 2600);
}

function hideTitleForShot() {
  var t = document.getElementById('title-screen');
  if (t) t.style.display = 'none';
  var l = document.getElementById('loading');
  if (l) l.style.display = 'none';
  var h = document.getElementById('hint');
  if (h) h.style.display = 'none';
}

// In shot mode the car drives itself so the chase looks alive in the still.
// It follows the road graph: at each intersection it picks the neighbouring
// intersection that gets closest to the objective, then the objective itself.
function autoDrivePlayer(dt) {
  if (!G.autoDrive || !G.playerCar) return;
  var c = G.playerCar;
  var obj = currentObjective();
  var tx = obj && obj.pos ? obj.pos.x : 2480;
  var ty = obj && obj.pos ? obj.pos.y : 1880;
  if (dist(c.x, c.y, tx, ty) < 220) {
    G.autoTarget = { x: tx, y: ty };
  } else if (!G.autoTarget || dist(c.x, c.y, G.autoTarget.x, G.autoTarget.y) < 46) {
    var node = nearestIntersection(c.x, c.y);
    var best = null, bd = 1e18;
    var all = intersections();
    for (var i = 0; i < all.length; i++) {
      var n = all[i];
      if (n.x === node.x && n.y === node.y) continue;
      var sameAve = n.x === node.x && Math.abs(n.y - node.y) <= 300;
      var sameSt = n.y === node.y && Math.abs(n.x - node.x) <= 340;
      if (!sameAve && !sameSt) continue;
      var d = dist(n.x, n.y, tx, ty);
      if (d < bd) { bd = d; best = n; }
    }
    G.autoTarget = best || { x: tx, y: ty };
  }
  var ta = angleTo(c.x, c.y, G.autoTarget.x, G.autoTarget.y);
  var diff = angleDiff(c.angle, ta);
  c.angle += clamp(diff, -2.4 * dt, 2.4 * dt);
  if (c.speed < 330) c.speed = Math.min(330, c.speed + c.acc * dt);
  c.x += Math.cos(c.angle) * c.speed * dt;
  c.y += Math.sin(c.angle) * c.speed * dt;
  if (collideCarBuildings(c)) { c.speed *= 0.5; c.angle += 0.6; }
  if (c.y > WATER_Y - 20) { c.y = WATER_Y - 20; c.angle = -c.angle; }
  clampToWorld(c, 40);
  G.player.x = c.x;
  G.player.y = c.y;
  G.player.angle = c.angle;
}
