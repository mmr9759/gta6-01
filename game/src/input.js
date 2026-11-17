// VELMARA: Streets of Gold — keyboard and mouse input.
// WASD/arrows to move and drive, mouse to aim, click to shoot, E to enter a car.
'use strict';

var Input = {
  keys: {},
  mouseX: 0,
  mouseY: 0,
  mouseDown: false,
  mouseClicked: false,
  wheel: 0
};

function inputInit(canvas) {
  window.addEventListener('keydown', function (e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    Input.keys[k] = true;
    if ([' ', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].indexOf(e.key) >= 0) e.preventDefault();
    if (k === 'm' && !e.repeat) onSoundToggle();
    if ((k === 'p' || k === 'Escape') && !e.repeat) onPauseToggle();
  });
  window.addEventListener('keyup', function (e) {
    var k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    Input.keys[k] = false;
  });
  canvas.addEventListener('mousemove', function (e) {
    var r = canvas.getBoundingClientRect();
    Input.mouseX = e.clientX - r.left;
    Input.mouseY = e.clientY - r.top;
  });
  canvas.addEventListener('mousedown', function (e) {
    if (e.button === 0) { Input.mouseDown = true; Input.mouseClicked = true; }
  });
  window.addEventListener('mouseup', function (e) {
    if (e.button === 0) Input.mouseDown = false;
  });
  canvas.addEventListener('wheel', function (e) {
    Input.wheel += e.deltaY;
    e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('contextmenu', function (e) { e.preventDefault(); });
}

function keyDown(k) {
  return !!Input.keys[k];
}

function anyMoveKey() {
  return keyDown('w') || keyDown('a') || keyDown('s') || keyDown('d') ||
    keyDown('ArrowUp') || keyDown('ArrowLeft') || keyDown('ArrowDown') || keyDown('ArrowRight');
}

// Movement vector from WASD/arrows, normalised.
function moveVector() {
  var x = 0, y = 0;
  if (keyDown('a') || keyDown('ArrowLeft')) x -= 1;
  if (keyDown('d') || keyDown('ArrowRight')) x += 1;
  if (keyDown('w') || keyDown('ArrowUp')) y -= 1;
  if (keyDown('s') || keyDown('ArrowDown')) y += 1;
  if (x !== 0 && y !== 0) { x *= 0.7071; y *= 0.7071; }
  return { x: x, y: y };
}

// True once when the key was pressed since the last frame; used for E, 1, 2, R.
var _pressedEdge = {};
function keyPressed(k) {
  var now = !!Input.keys[k];
  var was = !!_pressedEdge[k];
  _pressedEdge[k] = now;
  return now && !was;
}

// Aim angle in world space from the player position to the mouse cursor.
function aimAngle(worldX, worldY, cam) {
  var sx = (worldX - cam.x) * cam.zoom + cam.viewW / 2;
  var sy = (worldY - cam.y) * cam.zoom + cam.viewH / 2;
  return Math.atan2(Input.mouseY - sy, Input.mouseX - sx);
}

// Consume the click flag at the end of each frame so one click is one shot.
function inputEndFrame() {
  Input.mouseClicked = false;
}
