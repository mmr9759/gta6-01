// VELMARA: Streets of Gold — missions and story.
// Five jobs for Marisol, the fixer of Puerto del Sol, plus repeatable taxi fares
// once the story is done. Each mission is a chain of steps with a world marker,
// a minimap blip, dialogue, a timer where it matters, and a cash reward.
'use strict';

// Mission definitions: id, title, briefing lines, steps, reward.
var MISSIONS = [
  {
    id: 'courier', title: 'Job 1 — The Courier', reward: MISSION_REWARDS.courier,
    brief: [
      ['MARISOL', 'Riko. First job, easy money. Pick up the package at Mercado Viejo.'],
      ['MARISOL', 'Deliver it to Hotel Aurea in Centro. Fast — the client hates waiting.']
    ],
    steps: [
      { type: 'goto', at: 'market', text: 'Pick up the package at Mercado Viejo', radius: 70 },
      { type: 'goto', at: 'hotel', text: 'Deliver the package to Hotel Aurea', radius: 70, time: 100 }
    ]
  },
  {
    id: 'hotwheels', title: 'Job 2 — Hot Wheels', reward: MISSION_REWARDS.hotwheels,
    brief: [
      ['MARISOL', "A client wants an Aurea GT. There is a gold one parked at the marina."],
      ['MARISOL', 'Borrow it. Permanently. Bring it to Lalo\u2019s Garage in Las Lomas.']
    ],
    steps: [
      { type: 'steal', at: 'marinaCar', text: 'Steal the gold Aurea GT at the marina', radius: 60 },
      { type: 'driveTo', at: 'garage', text: 'Deliver the Aurea GT to Lalo\u2019s Garage', radius: 80 }
    ]
  },
  {
    id: 'harbor', title: 'Job 3 — Harbor Lights', reward: MISSION_REWARDS.harbor,
    brief: [
      ['MARISOL', 'Meet my contact at the docks, Pier 2. He has something for you.'],
      ['RIKO', 'And the catch?'],
      ['MARISOL', 'The catch is the police. Lose them, then come home.']
    ],
    steps: [
      { type: 'goto', at: 'docks', text: 'Meet the contact at the docks', radius: 70 },
      { type: 'escape', text: 'Lose the police — stay out of sight until the heat dies', radius: 0, time: 45 }
    ]
  },
  {
    id: 'shakedown', title: 'Job 4 — The Shakedown', reward: MISSION_REWARDS.shakedown,
    brief: [
      ['MARISOL', 'Three shops owe me protection money. Café Luna, Bar El Faro, Tienda Coral.'],
      ['MARISOL', 'Walk in, be polite, walk out with the cash. All three.']
    ],
    steps: [
      { type: 'collect', at: 'shops0', text: 'Collect from Café Luna', radius: 60 },
      { type: 'collect', at: 'shops1', text: 'Collect from Bar El Faro', radius: 60 },
      { type: 'collect', at: 'shops2', text: 'Collect from Tienda Coral', radius: 60 }
    ]
  },
  {
    id: 'goldrun', title: 'Job 5 — The Gold Run', reward: MISSION_REWARDS.goldrun,
    brief: [
      ['MARISOL', 'Last job, Riko. The gold from Banco de Velmara goes to my yacht.'],
      ['MARISOL', 'Every cop in the city will be on you. Drive like the gold is yours.'],
      ['RIKO', 'After this, I am done owing anybody anything.']
    ],
    steps: [
      { type: 'goto', at: 'bank', text: 'Grab the gold at Banco de Velmara', radius: 70 },
      { type: 'deliver', at: 'yacht', text: 'Deliver the gold to the yacht at the harbor', radius: 80, time: 170, wanted: 3 }
    ]
  }
];

function missionPos(step) {
  var L = CITY.landmarks;
  if (!step.at) return null;
  if (step.at === 'marinaCar') return { x: 2480, y: 2240 };
  if (step.at.indexOf('shops') === 0) {
    var idx = parseInt(step.at.slice(5), 10);
    var s = L.shops[idx];
    return { x: s.x, y: s.y };
  }
  var lm = L[step.at];
  return lm ? { x: lm.x, y: lm.y } : null;
}

function missionMarkerPos() {
  // Where the next mission starts: the "M" marker on the map.
  var L = CITY.landmarks;
  var starts = [L.market, L.garage, L.docks, L.shops[0], L.bank];
  var idx = Math.min(G.missionIndex, starts.length - 1);
  return starts[idx];
}

// Start the next story mission (called when the player reaches the M marker).
function startMission(idx) {
  var def = MISSIONS[idx];
  if (!def) return;
  G.mission = {
    def: def, index: idx, step: 0, state: 'active',
    stepT: 0, collectT: 0, escapeT: 0, startedAt: G.time
  };
  var step = def.steps[0];
  if (step.time) G.mission.stepT = step.time;
  if (step.type === 'steal') spawnMarinaCar();
  showSubtitleSequence(def.brief);
  updateObjectiveHUD();
  sfxMissionPass();
}

// The current objective, for the HUD and the minimap.
function currentObjective() {
  if (!G.mission) return null;
  var def = G.mission.def;
  if (G.mission.step >= def.steps.length) return null;
  var step = def.steps[G.mission.step];
  var pos = missionPos(step);
  return { step: step, pos: pos, title: def.title };
}

// Advance the mission state machine every frame.
function updateMissions(dt) {
  // Taxi fares appear once the story is done (or after job 1, as side money).
  if (!G.mission && G.missionIndex >= 1 && !G.fare && Math.random() < dt * 0.06) spawnFare();

  if (G.fare) updateFare(dt);

  if (!G.mission) {
    // Standing on the M marker starts the next job.
    if (G.missionIndex < MISSIONS.length) {
      var mp = missionMarkerPos();
      if (dist(G.player.x, G.player.y, mp.x, mp.y) < 70) {
        startMission(G.missionIndex);
      }
    }
    return;
  }
  var m = G.mission;
  var def = m.def;
  if (m.step >= def.steps.length) return;
  var step = def.steps[m.step];
  var pos = missionPos(step);

  // Timed steps. The escape step never fails on the timer: the contact vouches.
  if (step.time) {
    m.stepT -= dt;
    if (m.stepT <= 0 && step.type !== 'escape') {
      failMission('Out of time — Marisol does not pay late.');
      return;
    }
  }

  if (step.type === 'goto' || step.type === 'driveTo' || step.type === 'deliver') {
    if (pos && dist(G.player.x, G.player.y, pos.x, pos.y) < step.radius) {
      if (step.type === 'deliver' && step.wanted) {
        // The gold run ends at the yacht: hand it over.
      }
      advanceStep();
    }
  } else if (step.type === 'steal') {
    // Done when the player is driving the gold Aurea GT from the marina.
    if (G.playerCar && G.playerCar.missionCar) {
      advanceStep();
    }
  } else if (step.type === 'escape') {
    if (wantedStars() === 0) {
      m.escapeT += dt;
      if (m.escapeT > 3) advanceStep();
    } else {
      m.escapeT = 0;
    }
    // Failing to escape in time is not a fail: the timer is the challenge.
    if (step.time && m.stepT <= 0) {
      // Still wanted when the timer ends: the contact vouches for you anyway.
      G.heat = Math.max(0, G.heat - 40);
      advanceStep();
    }
  } else if (step.type === 'collect') {
    if (pos && dist(G.player.x, G.player.y, pos.x, pos.y) < step.radius) {
      m.collectT += dt;
      if (m.collectT > 0.4 && m.collectT < 0.5) {
        showToast('Collecting…');
      }
      if (m.collectT >= 2) {
        m.collectT = 0;
        showToast('Collected. $' + Math.round(def.reward / def.steps.length) + ' in the bag.');
        sfxPickup();
        advanceStep();
      }
    } else {
      m.collectT = 0;
    }
  }

  // The gold run keeps three stars hot until the yacht.
  if (def.id === 'goldrun' && m.step === 1 && step.wanted) {
    if (G.heat < step.wanted * HEAT_PER_STAR) G.heat = step.wanted * HEAT_PER_STAR;
  }
}

function advanceStep() {
  var m = G.mission;
  m.step++;
  m.collectT = 0;
  m.escapeT = 0;
  if (m.step >= m.def.steps.length) {
    completeMission();
    return;
  }
  var step = m.def.steps[m.step];
  if (step.time) m.stepT = step.time;
  if (step.type === 'steal') spawnMarinaCar();
  if (step.type === 'escape') {
    addHeat(2 * HEAT_PER_STAR, 'police tipped off');
    showToast('The police are onto you — lose them!');
  }
  if (step.type === 'deliver' && step.wanted) {
    addHeat(step.wanted * HEAT_PER_STAR, 'gold run');
    showToast('The gold is yours — every cop in Velmara is coming!');
  }
  updateObjectiveHUD();
}

// The gold Aurea GT, parked at the marina for job 2.
function spawnMarinaCar() {
  var c = makeCar(2, 2480, 2240, Math.PI / 2, '#d4af37');
  c.parked = true;
  c.driver = false;
  c.missionCar = true;
  G.cars.push(c);
  return c;
}

function completeMission() {
  var m = G.mission;
  var reward = m.def.reward;
  G.player.cash += reward;
  G.missionIndex = m.index + 1;
  G.completedMissions++;
  showBanner('MISSION PASSED', m.def.title + '  ·  +$' + reward, false);
  sfxMissionPass();
  showSubtitle('MARISOL', 'Beautiful work, Riko. The money is yours. Come see me when you want more.');
  G.mission = null;
  saveGame();
  updateObjectiveHUD();
}

function failMission(reason) {
  if (!G.mission) return;
  showBanner('MISSION FAILED', reason, true);
  sfxMissionFail();
  G.mission = null;
  updateObjectiveHUD();
}

// A failed run (wasted / busted) fails the active mission too.
function failCurrentMission(reason) {
  if (G.mission) failMission(reason);
}

// ---- Taxi fares: repeatable side money ----
function spawnFare() {
  var a = randomIntersection();
  var b = randomIntersection();
  if (dist(a.x, a.y, b.x, b.y) < 500) return;
  var fare = Math.round(rand(TAXI_FARE_MIN, TAXI_FARE_MAX));
  G.fare = { px: a.x, py: a.y, dx: b.x, dy: b.y, fare: fare, state: 'pickup', t: 90 };
  showToast('Taxi fare nearby — pick up the passenger for $' + fare + '.');
}

function updateFare(dt) {
  var f = G.fare;
  f.t -= dt;
  if (f.t <= 0) {
    showToast('The passenger gave up and walked away.');
    G.fare = null;
    updateObjectiveHUD();
    return;
  }
  if (f.state === 'pickup') {
    if (G.playerCar && dist(G.player.x, G.player.y, f.px, f.py) < 60) {
      f.state = 'dropoff';
      showToast('Passenger aboard — take them to the marker.');
      sfxPickup();
    }
  } else if (f.state === 'dropoff') {
    if (dist(G.player.x, G.player.y, f.dx, f.dy) < 70) {
      G.player.cash += f.fare;
      addParticles(G.player.x, G.player.y, 12, '#7dff8a');
      showBanner('FARE COMPLETE', '+$' + f.fare + ' — nice driving.', false);
      sfxMissionPass();
      G.fare = null;
      saveGame();
    }
  }
  updateObjectiveHUD();
}
