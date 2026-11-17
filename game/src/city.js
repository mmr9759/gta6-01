// VELMARA: Streets of Gold — city generation.
// Builds Velmara once from the fixed world seed: roads, blocks, buildings, palms,
// lamps, the harbor, and every landmark missions and shops need. Also the road graph
// traffic and pedestrians drive and walk on.
'use strict';

var CITY = null;

// A building: axis-aligned box with a roof colour, a fake height (shadow offset),
// a district, and precomputed windows so the painter never re-rolls.
function makeBuilding(x, y, w, h, district, tall) {
  var r = worldRand;
  var roof = pick(PALETTES[district] || PALETTES.downtown, r);
  var height = tall ? randi(14, 26, r) : randi(4, 10, r);
  var windows = [];
  var cols = Math.max(1, Math.floor(w / 26));
  var rows = Math.max(1, Math.floor(h / 26));
  for (var i = 0; i < cols; i++) {
    for (var j = 0; j < rows; j++) {
      if (chance(0.55, r)) windows.push([x + 8 + i * 26, y + 8 + j * 26]);
    }
  }
  return { x: x, y: y, w: w, h: h, roof: roof, height: height, district: district, windows: windows, tall: tall };
}

function districtOfBlock(cx, cy) {
  var d = districtAt(cx, cy);
  return d.id === 'beach' ? 'marina' : d.id;
}

// Generate the whole city. Deterministic: same seed, same Velmara.
function genCity() {
  var r = worldRand;
  var buildings = [];
  var palms = [];
  var lamps = [];
  var trees = [];

  // Blocks between roads. Skip the park, the beach, and the harbor basin.
  for (var ai = 0; ai < AVENUES.length - 1; ai++) {
    for (var si = 0; si < STREETS.length - 1; si++) {
      var x0 = AVENUES[ai] + ROAD_W / 2 + SIDEWALK + 6;
      var x1 = AVENUES[ai + 1] - ROAD_W / 2 - SIDEWALK - 6;
      var y0 = STREETS[si] + STREET_W / 2 + SIDEWALK + 6;
      var y1 = STREETS[si + 1] - STREET_W / 2 - SIDEWALK - 6;
      var cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
      if (y0 > SAND_TOP - 40) continue; // beach / water blocks stay open
      var district = districtOfBlock(cx, cy);
      if (district === 'park') {
        // Parque Verde: trees, paths, a pond, no buildings.
        var n = randi(7, 11, r);
        for (var t = 0; t < n; t++) {
          trees.push({ x: rand(x0 + 20, x1 - 20, r), y: rand(y0 + 20, y1 - 20, r), s: rand(0.8, 1.4, r) });
        }
        continue;
      }
      var bw = x1 - x0, bh = y1 - y0;
      var tall = district === 'downtown';
      if (bw > 190 && bh > 150 && chance(0.7, r)) {
        // Two buildings side by side with a courtyard gap.
        var split = rand(0.42, 0.58, r);
        buildings.push(makeBuilding(x0, y0, bw * split - 12, bh - 16, district, tall));
        buildings.push(makeBuilding(x0 + bw * split + 12, y0, bw * (1 - split) - 12, bh - 16, district, tall));
      } else {
        buildings.push(makeBuilding(x0 + 6, y0 + 6, bw - 12, bh - 12, district, tall));
      }
      // A tree or two in the block corners.
      if (chance(0.6, r)) trees.push({ x: x0 + rand(10, 30, r), y: y0 + rand(10, 30, r), s: rand(0.7, 1.1, r) });
    }
  }

  // Palms along the coastal road (Paseo de las Palmas) and the marina.
  for (var px = 180; px < WORLD_W; px += 130) {
    palms.push({ x: px + rand(-14, 14, r), y: STREETS[STREETS.length - 1] - 52, s: rand(0.9, 1.3, r) });
    if (chance(0.5, r)) palms.push({ x: px + 60, y: STREETS[STREETS.length - 1] + 52, s: rand(0.9, 1.3, r) });
  }
  for (var py = 240; py < SAND_TOP; py += 210) {
    if (chance(0.7, r)) palms.push({ x: 3360 - 40, y: py, s: rand(0.9, 1.3, r) });
  }

  // Street lamps at every intersection corner.
  for (var a = 0; a < AVENUES.length; a++) {
    for (var s = 0; s < STREETS.length; s++) {
      lamps.push({ x: AVENUES[a] + ROAD_W / 2 + 8, y: STREETS[s] - STREET_W / 2 - 8 });
    }
  }

  // Docks: three piers jutting into the harbor.
  var piers = [
    { x: 2560, y: WATER_Y, w: 60, h: 130 },
    { x: 2880, y: WATER_Y, w: 60, h: 170 },
    { x: 3200, y: WATER_Y, w: 60, h: 130 }
  ];

  // Landmarks (mission + shop anchors). Positions are fixed intersections.
  var landmarks = {
    safehouse: { x: 560, y: 480, name: 'Safehouse', blurb: "Riko's flat" },
    market: { x: 880, y: 760, name: 'Mercado Viejo', blurb: 'Old market' },
    hotel: { x: 1840, y: 1040, name: 'Hotel Aurea', blurb: 'The golden hotel' },
    garage: { x: 3120, y: 1320, name: "Lalo's Garage", blurb: 'Chop shop' },
    docks: { x: 2880, y: 2240, name: 'The Docks', blurb: 'Pier 2, container 7' },
    bank: { x: 1520, y: 1320, name: 'Banco de Velmara', blurb: 'The gold vault' },
    yacht: { x: 3200, y: 2460, name: 'Yacht Marisol', blurb: 'The getaway yacht' },
    hospital: { x: 1200, y: 200, name: 'Clinica Sol', blurb: 'Free healing' },
    gunshop: { x: 2480, y: 1880, name: 'Velmara Arms', blurb: 'Ammo $50' },
    spray: { x: 880, y: 1880, name: 'Pintura Rosa', blurb: 'Pay-n-spray $300' },
    shops: [
      { x: 560, y: 1040, name: 'Café Luna' },
      { x: 2160, y: 760, name: 'Bar El Faro' },
      { x: 2800, y: 1600, name: 'Tienda Coral' }
    ]
  };

  CITY = {
    buildings: buildings, palms: palms, lamps: lamps, trees: trees, piers: piers,
    landmarks: landmarks, seed: WORLD_SEED
  };
  return CITY;
}

// ---- Road graph helpers (traffic + pedestrians + spawning) ----

// All intersections, cached after generation.
var INTERSECTIONS = null;
function intersections() {
  if (INTERSECTIONS) return INTERSECTIONS;
  INTERSECTIONS = [];
  for (var a = 0; a < AVENUES.length; a++) {
    for (var s = 0; s < STREETS.length; s++) {
      INTERSECTIONS.push({ x: AVENUES[a], y: STREETS[s] });
    }
  }
  return INTERSECTIONS;
}

function randomIntersection(rng) {
  return pick(intersections(), rng);
}

function nearestIntersection(x, y) {
  var best = null, bd = 1e18;
  var all = intersections();
  for (var i = 0; i < all.length; i++) {
    var d = dist(x, y, all[i].x, all[i].y);
    if (d < bd) { bd = d; best = all[i]; }
  }
  return best;
}

// Is this point on a road (within the asphalt, sidewalks excluded)?
function isOnRoad(x, y) {
  for (var i = 0; i < AVENUES.length; i++) {
    if (Math.abs(x - AVENUES[i]) <= ROAD_W / 2) return true;
  }
  for (var j = 0; j < STREETS.length; j++) {
    if (Math.abs(y - STREETS[j]) <= STREET_W / 2) return true;
  }
  return false;
}

// Snap a point to the nearest road centre line (used when spawning cars).
function nearestRoadPoint(x, y) {
  var bx = AVENUES[0], bd = 1e18;
  for (var i = 0; i < AVENUES.length; i++) {
    var d = Math.abs(x - AVENUES[i]);
    if (d < bd) { bd = d; bx = AVENUES[i]; }
  }
  var by = STREETS[0]; bd = 1e18;
  for (var j = 0; j < STREETS.length; j++) {
    var d2 = Math.abs(y - STREETS[j]);
    if (d2 < bd) { bd = d2; by = STREETS[j]; }
  }
  if (Math.abs(x - bx) < Math.abs(y - by)) return { x: bx, y: y, axis: 'v' };
  return { x: x, y: by, axis: 'h' };
}

function isWater(x, y) {
  return y >= WATER_Y;
}

function isBeach(x, y) {
  return y >= SAND_TOP && y < WATER_Y;
}

// The building (if any) whose box contains this point.
function buildingAt(x, y) {
  var bs = CITY.buildings;
  for (var i = 0; i < bs.length; i++) {
    var b = bs[i];
    if (x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h) return b;
  }
  return null;
}

// Push a circle out of every building it overlaps. Returns true on a hit.
function collideCircleBuildings(ent, radius) {
  var hit = false;
  var bs = CITY.buildings;
  for (var i = 0; i < bs.length; i++) {
    var b = bs[i];
    var nx = clamp(ent.x, b.x, b.x + b.w);
    var ny = clamp(ent.y, b.y, b.y + b.h);
    var dx = ent.x - nx, dy = ent.y - ny;
    var d2 = dx * dx + dy * dy;
    if (d2 < radius * radius) {
      hit = true;
      if (d2 > 0.0001) {
        var d = Math.sqrt(d2);
        ent.x = nx + (dx / d) * radius;
        ent.y = ny + (dy / d) * radius;
      } else {
        // Centre inside the box: push out along the smallest penetration.
        var pl = ent.x - b.x, pr = b.x + b.w - ent.x;
        var pt = ent.y - b.y, pb = b.y + b.h - ent.y;
        var m = Math.min(pl, pr, pt, pb);
        if (m === pl) ent.x = b.x - radius;
        else if (m === pr) ent.x = b.x + b.w + radius;
        else if (m === pt) ent.y = b.y - radius;
        else ent.y = b.y + b.h + radius;
      }
    }
  }
  return hit;
}

function clampToWorld(ent, margin) {
  ent.x = clamp(ent.x, margin, WORLD_W - margin);
  ent.y = clamp(ent.y, margin, WORLD_H - margin);
}
