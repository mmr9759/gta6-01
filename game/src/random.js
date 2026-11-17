// VELMARA: Streets of Gold — deterministic random helpers.
// The city is generated from one fixed seed so every run paints the same Velmara;
// gameplay randomness uses a separate stream so replays stay varied.
'use strict';

// mulberry32: a small fast seeded PRNG.
function mulberry32(seed) {
  var a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// The world seed: fixed, so the city never changes between runs.
var WORLD_SEED = 20261117;
var worldRand = mulberry32(WORLD_SEED);

// The gameplay stream: seeded from the clock at load, varied every session.
var gameRand = mulberry32((Date.now() % 2147483647) ^ 0x9e3779b9);

function rand(lo, hi, rng) {
  var r = rng || gameRand;
  return lo + r() * (hi - lo);
}

function randi(lo, hi, rng) {
  return Math.floor(rand(lo, hi + 1, rng));
}

function pick(arr, rng) {
  var r = rng || gameRand;
  return arr[Math.floor(r() * arr.length)];
}

function chance(p, rng) {
  var r = rng || gameRand;
  return r() < p;
}

function clamp(v, lo, hi) {
  return v < lo ? lo : (v > hi ? hi : v);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function dist(x1, y1, x2, y2) {
  var dx = x2 - x1, dy = y2 - y1;
  return Math.sqrt(dx * dx + dy * dy);
}

function angleTo(x1, y1, x2, y2) {
  return Math.atan2(y2 - y1, x2 - x1);
}

// Shortest signed turn from angle a to angle b, in (-PI, PI].
function angleDiff(a, b) {
  var d = b - a;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d <= -Math.PI) d += Math.PI * 2;
  return d;
}

// Fisher-Yates shuffle, in place, on the given stream.
function shuffle(arr, rng) {
  var r = rng || gameRand;
  for (var i = arr.length - 1; i > 0; i--) {
    var j = Math.floor(r() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

// Pick one entry from [value, weight] pairs.
function weightedPick(pairs, rng) {
  var r = rng || gameRand;
  var total = 0;
  for (var i = 0; i < pairs.length; i++) total += pairs[i][1];
  var roll = r() * total;
  for (var j = 0; j < pairs.length; j++) {
    roll -= pairs[j][1];
    if (roll <= 0) return pairs[j][0];
  }
  return pairs[pairs.length - 1][0];
}

// A cheap deterministic 2D hash in [0, 1): used for water sparkle and window lights.
function hash2(x, y) {
  var h = Math.sin(x * 127.1 + y * 311.7) * 43758.5453;
  return h - Math.floor(h);
}

// Approximate gaussian (mean 0, ~unit variance) from three uniforms.
function gauss(rng) {
  var r = rng || gameRand;
  return (r() + r() + r() - 1.5) * 1.2;
}
