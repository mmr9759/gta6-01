// VELMARA: Streets of Gold — configuration and shared constants.
// An original open-world crime game: a sun-soaked harbor city, built from scratch.
// Nothing here comes from any commercial game: every name, place and vehicle is invented.
'use strict';

// World size in pixels (top-down city).
var WORLD_W = 3600;
var WORLD_H = 2600;

// Road network: avenues run north-south, streets east-west.
var AVENUES = [240, 560, 880, 1200, 1520, 1840, 2160, 2480, 2800, 3120, 3360];
var STREETS = [200, 480, 760, 1040, 1320, 1600, 1880, 2160];
var ROAD_W = 64;   // avenue width
var STREET_W = 56; // street width
var SIDEWALK = 14; // sidewalk band on each side of a road

// Harbor: water starts at this y; the sand band sits just above it.
var WATER_Y = 2380;
var SAND_TOP = 2300;

// Game clock: one real second is one game minute; a full day is 24 real minutes.
var MINUTES_PER_SECOND = 1;

// Wanted: heat 0..100, stars = ceil(heat / 20), capped at 5.
var HEAT_PER_STAR = 20;
var MAX_STARS = 5;

// Money.
var START_CASH = 150;
var SPRAY_COST = 300;   // pay-n-spray: repair car + clear wanted
var AMMO_COST = 50;
var AMMO_PACK = 24;

// Player tuning.
var WALK_SPEED = 175;
var RUN_SPEED = 265;
var PLAYER_RADIUS = 13;
var PLAYER_HEALTH = 100;
var PLAYER_REGEN = 3; // health per second after 5 s without damage

// District roof palettes, picked per district at generation time.
var PALETTES = {
  downtown: ['#7d8aa0', '#6b7a90', '#8a7d6b', '#5d6b7a', '#9a8f7a'],
  oldtown: ['#c96f4a', '#d9a05b', '#b8573f', '#e0b25f', '#a34d5c'],
  barrio: ['#7a9a6d', '#c2a15a', '#8a6d8f', '#b0785a', '#6d8a9a'],
  marina: ['#8a97a8', '#a89a7a', '#7a8a99', '#b0a08a', '#6d7a8a']
};

// Car models: size, top speed (px/s), acceleration, handling, paint colours.
var CAR_MODELS = [
  { name: 'Pico', w: 34, l: 58, top: 330, acc: 260, grip: 2.6, colors: ['#c0392b', '#2980b9', '#f1c40f', '#ecf0f1', '#7f8c8d'] },
  { name: 'Cometa', w: 36, l: 64, top: 380, acc: 300, grip: 2.8, colors: ['#2c3e50', '#8e44ad', '#16a085', '#d35400', '#bdc3c7'] },
  { name: 'Aurea GT', w: 36, l: 66, top: 470, acc: 380, grip: 3.4, colors: ['#d4af37', '#c0392b', '#1a1a1a', '#f5f5f5', '#1abc9c'] },
  { name: 'Burro Truck', w: 40, l: 84, top: 280, acc: 200, grip: 2.2, colors: ['#7f8c8d', '#95a5a6', '#5d6d7e', '#a04000'] },
  { name: 'Taxi', w: 34, l: 60, top: 350, acc: 280, grip: 2.7, colors: ['#f7c948'] },
  { name: 'Patrol Interceptor', w: 36, l: 64, top: 430, acc: 360, grip: 3.2, colors: ['#f5f5f5'] }
];

// Pedestrian shirt colours.
var PED_COLORS = ['#e74c3c', '#3498db', '#2ecc71', '#f39c12', '#9b59b6', '#ecf0f1', '#1abc9c', '#e67e22', '#fd79a8', '#00cec9'];

// Street names for the HUD district label and mission flavour text.
var STREET_NAMES = [
  'Avenida del Mar', 'Calle Oro', 'Paseo de las Palmas', 'Avenida Central',
  'Calle Luna', 'Bulevar Coral', 'Calle Vela', 'Avenida Puerto'
];

// Districts: name, bounds, roof palette key, flavour line for the HUD.
var DISTRICTS = [
  { id: 'oldtown', name: 'Casco Viejo', x0: 0, y0: 0, x1: 1150, y1: 720, palette: 'oldtown', blurb: 'pastel houses, narrow lanes' },
  { id: 'park', name: 'Parque Verde', x0: 2500, y0: 0, x1: 3600, y1: 720, palette: 'park', blurb: 'the city lungs' },
  { id: 'downtown', name: 'Centro', x0: 1150, y0: 720, x1: 2500, y1: 1650, palette: 'downtown', blurb: 'glass towers and gold' },
  { id: 'barrio', name: 'Las Lomas', x0: 2500, y0: 720, x1: 3600, y1: 2300, palette: 'barrio', blurb: 'the hills that never sleep' },
  { id: 'marina', name: 'Puerto del Sol', x0: 0, y0: 1650, x1: 2500, y1: 2380, palette: 'marina', blurb: 'docks, fish and deals' },
  { id: 'beach', name: 'Playa Dorada', x0: 0, y0: 2300, x1: 3600, y1: 2600, palette: 'marina', blurb: 'sand, surf and sirens' }
];

function districtAt(x, y) {
  for (var i = 0; i < DISTRICTS.length; i++) {
    var d = DISTRICTS[i];
    if (x >= d.x0 && x < d.x1 && y >= d.y0 && y < d.y1) return d;
  }
  return DISTRICTS[2];
}

// Mission tuning.
var MISSION_REWARDS = { courier: 400, hotwheels: 600, harbor: 800, shakedown: 1000, goldrun: 2500 };
var TAXI_FARE_MIN = 25;
var TAXI_FARE_MAX = 70;

// Save slot.
var SAVE_KEY = 'velmara-streets-of-gold-save-v1';

// Screenshot staging: ?shot=1..4 renders a staged scene for the dossier.
var SHOT_COUNT = 4;
