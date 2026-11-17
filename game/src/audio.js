// VELMARA: Streets of Gold — synthesized sound.
// Every sound is generated with the Web Audio API: no audio files, no network.
// Engine hum, sirens, gunshots, pickups and a small synthwave loop.
'use strict';

var AudioSys = {
  ctx: null,
  master: null,
  musicGain: null,
  sfxGain: null,
  enabled: true,
  musicTimer: null,
  engineOsc: null,
  engineGain: null,
  sirenOsc: null,
  sirenGain: null,
  sirenPhase: 0,
  musicStep: 0,
  started: false
};

// A minor-key bassline loop with hats: the sound of driving at dusk.
var MUSIC_BASS = [45, 0, 45, 0, 48, 0, 45, 0, 43, 0, 43, 0, 50, 0, 48, 0];
var MUSIC_LEAD = [69, 0, 72, 76, 0, 74, 72, 0, 69, 0, 67, 69, 0, 0, 64, 0];

function audioInit() {
  if (AudioSys.ctx) return;
  try {
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    AudioSys.ctx = new AC();
    AudioSys.master = AudioSys.ctx.createGain();
    AudioSys.master.gain.value = AudioSys.enabled ? 0.9 : 0;
    AudioSys.master.connect(AudioSys.ctx.destination);
    AudioSys.musicGain = AudioSys.ctx.createGain();
    AudioSys.musicGain.gain.value = 0.16;
    AudioSys.musicGain.connect(AudioSys.master);
    AudioSys.sfxGain = AudioSys.ctx.createGain();
    AudioSys.sfxGain.gain.value = 0.5;
    AudioSys.sfxGain.connect(AudioSys.master);
    // Engine: a low sawtooth whose pitch follows speed.
    AudioSys.engineOsc = AudioSys.ctx.createOscillator();
    AudioSys.engineOsc.type = 'sawtooth';
    AudioSys.engineOsc.frequency.value = 40;
    AudioSys.engineGain = AudioSys.ctx.createGain();
    AudioSys.engineGain.gain.value = 0;
    var engFilter = AudioSys.ctx.createBiquadFilter();
    engFilter.type = 'lowpass';
    engFilter.frequency.value = 420;
    AudioSys.engineOsc.connect(engFilter);
    engFilter.connect(AudioSys.engineGain);
    AudioSys.engineGain.connect(AudioSys.master);
    AudioSys.engineOsc.start();
    // Siren: two alternating tones, gain follows the nearest cop.
    AudioSys.sirenOsc = AudioSys.ctx.createOscillator();
    AudioSys.sirenOsc.type = 'sine';
    AudioSys.sirenOsc.frequency.value = 720;
    AudioSys.sirenGain = AudioSys.ctx.createGain();
    AudioSys.sirenGain.gain.value = 0;
    AudioSys.sirenOsc.connect(AudioSys.sirenGain);
    AudioSys.sirenGain.connect(AudioSys.master);
    AudioSys.sirenOsc.start();
  } catch (e) {
    AudioSys.ctx = null;
  }
}

function audioResume() {
  if (AudioSys.ctx && AudioSys.ctx.state === 'suspended') AudioSys.ctx.resume();
  if (!AudioSys.started && AudioSys.ctx) {
    AudioSys.started = true;
    startMusicLoop();
  }
}

function audioSetEnabled(on) {
  AudioSys.enabled = on;
  if (AudioSys.master) AudioSys.master.gain.value = on ? 0.9 : 0;
}

function audioTone(freq, dur, type, vol, slideTo) {
  if (!AudioSys.ctx || !AudioSys.enabled) return;
  try {
    var t = AudioSys.ctx.currentTime;
    var o = AudioSys.ctx.createOscillator();
    var g = AudioSys.ctx.createGain();
    o.type = type || 'sine';
    o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + dur);
    g.gain.setValueAtTime(vol || 0.2, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.connect(g);
    g.connect(AudioSys.sfxGain);
    o.start(t);
    o.stop(t + dur + 0.02);
  } catch (e) {}
}

function audioNoise(dur, vol, freq) {
  if (!AudioSys.ctx || !AudioSys.enabled) return;
  try {
    var t = AudioSys.ctx.currentTime;
    var len = Math.floor(AudioSys.ctx.sampleRate * dur);
    var buf = AudioSys.ctx.createBuffer(1, len, AudioSys.ctx.sampleRate);
    var data = buf.getChannelData(0);
    for (var i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
    var src = AudioSys.ctx.createBufferSource();
    src.buffer = buf;
    var f = AudioSys.ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.value = freq || 1200;
    var g = AudioSys.ctx.createGain();
    g.gain.value = vol || 0.3;
    src.connect(f);
    f.connect(g);
    g.connect(AudioSys.sfxGain);
    src.start(t);
  } catch (e) {}
}

// ---- Named sound effects (one call each, used by gameplay code) ----
function sfxShoot() { audioNoise(0.12, 0.5, 2400); audioTone(160, 0.08, 'square', 0.18, 60); }
function sfxPunch() { audioNoise(0.08, 0.35, 700); audioTone(90, 0.1, 'sine', 0.25, 50); }
function sfxCrash() { audioNoise(0.25, 0.5, 900); }
function sfxPickup() { audioTone(660, 0.09, 'sine', 0.22); setTimeout(function () { audioTone(880, 0.12, 'sine', 0.22); }, 70); }
function sfxMissionPass() {
  var notes = [523, 659, 784, 1047];
  for (var i = 0; i < notes.length; i++) {
    (function (n, d) { setTimeout(function () { audioTone(n, 0.22, 'triangle', 0.25); }, d); })(notes[i], i * 110);
  }
}
function sfxMissionFail() { audioTone(220, 0.5, 'sawtooth', 0.2, 110); }
function sfxSirenBlip() { audioTone(950, 0.15, 'sine', 0.12, 700); }
function sfxEnterCar() { audioTone(300, 0.12, 'triangle', 0.2, 180); }
function sfxSkid() { audioNoise(0.15, 0.12, 3000); }

// The music loop: one step every 150 ms, bass + sparse lead + hat ticks.
function startMusicLoop() {
  if (AudioSys.musicTimer) return;
  AudioSys.musicTimer = setInterval(function () {
    if (!AudioSys.ctx || !AudioSys.enabled) return;
    var step = AudioSys.musicStep % 16;
    var bass = MUSIC_BASS[step];
    if (bass) {
      var f = 440 * Math.pow(2, (bass - 69) / 12);
      var t = AudioSys.ctx.currentTime;
      var o = AudioSys.ctx.createOscillator();
      var g = AudioSys.ctx.createGain();
      o.type = 'triangle';
      o.frequency.value = f / 2;
      g.gain.setValueAtTime(0.5, t);
      g.gain.exponentialRampToValueAtTime(0.001, t + 0.16);
      o.connect(g); g.connect(AudioSys.musicGain);
      o.start(t); o.stop(t + 0.18);
    }
    var lead = MUSIC_LEAD[step];
    if (lead && AudioSys.musicStep % 32 >= 16) {
      var lf = 440 * Math.pow(2, (lead - 69) / 12);
      var t2 = AudioSys.ctx.currentTime;
      var o2 = AudioSys.ctx.createOscillator();
      var g2 = AudioSys.ctx.createGain();
      o2.type = 'sine';
      o2.frequency.value = lf;
      g2.gain.setValueAtTime(0.16, t2);
      g2.gain.exponentialRampToValueAtTime(0.001, t2 + 0.3);
      o2.connect(g2); g2.connect(AudioSys.musicGain);
      o2.start(t2); o2.stop(t2 + 0.32);
    }
    AudioSys.musicStep++;
  }, 150);
}

// Called every frame: engine pitch from speed, siren wail from nearest cop.
function audioUpdate(dt, speedNorm, nearestCopDist, inCar) {
  if (!AudioSys.ctx) return;
  var t = AudioSys.ctx.currentTime;
  if (AudioSys.engineGain) {
    var target = inCar ? 0.05 + speedNorm * 0.06 : 0;
    AudioSys.engineGain.gain.setTargetAtTime(target, t, 0.1);
    AudioSys.engineOsc.frequency.setTargetAtTime(42 + speedNorm * 130 + (inCar ? 8 : 0), t, 0.1);
  }
  if (AudioSys.sirenGain) {
    AudioSys.sirenPhase += dt * 2.4;
    var twoTone = (Math.floor(AudioSys.sirenPhase) % 2 === 0) ? 720 : 960;
    AudioSys.sirenOsc.frequency.setTargetAtTime(twoTone, t, 0.05);
    var vol = 0;
    if (nearestCopDist < 900) vol = 0.05 * (1 - nearestCopDist / 900);
    AudioSys.sirenGain.gain.setTargetAtTime(vol, t, 0.2);
  }
}
