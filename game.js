"use strict";

const arena = document.querySelector("#arena");
const statusBox = document.querySelector("#status");
const controls = document.querySelector("#controls");
const stick = document.querySelector("#stick");
const knob = document.querySelector("#knob");
const fullscreen = document.querySelector("#fullscreen");
const actionButtons = [...document.querySelectorAll("[data-action]")];
const pressed = new Set();
const pointers = new Map();
let stickPointer = null;
let player;

function gameLoadFailed() {
  statusBox.hidden = false;
  const retry = document.createElement("button");
  retry.textContent = "重新加载";
  retry.onclick = () => location.reload();
  statusBox.replaceChildren("游戏资源加载失败", retry);
}

function gameLoaded() {
  statusBox.hidden = true;
}

function raceControlsVisible(show) {
  controls.hidden = !show;
  if (!show) resetVisuals();
}

function key(action, down) {
  if (pressed.has(action) === down) return;
  if (down) pressed.add(action);
  else pressed.delete(action);
  player.ruffle().callExternalInterface("touchControl", action, down);
}

function resetVisuals() {
  pressed.clear();
  pointers.clear();
  stickPointer = null;
  knob.style.transform = "";
  for (const button of actionButtons) button.classList.remove("held");
}

function releaseAll() {
  if (pressed.size) player?.ruffle().callExternalInterface("releaseControls");
  resetVisuals();
}

function moveStick(event) {
  if (event.pointerId !== stickPointer) return;
  const bounds = stick.getBoundingClientRect();
  const dx = (event.clientX - bounds.left) / bounds.width * 2 - 1;
  const dy = (event.clientY - bounds.top) / bounds.height * 2 - 1;
  const length = Math.max(1, Math.hypot(dx, dy));
  const x = dx / length, y = dy / length;
  const travel = bounds.width * .30;
  knob.style.transform = `translate(${x * travel}px, ${y * travel}px)`;
  key("forward", x > .28);
  key("back", x < -.28);
  key("noseUp", y < -.48);
  key("noseDown", y > .48);
}

stick.addEventListener("pointerdown", event => {
  event.preventDefault();
  if (stickPointer !== null) return;
  stickPointer = event.pointerId;
  stick.setPointerCapture(event.pointerId);
  moveStick(event);
});
stick.addEventListener("pointermove", moveStick);

function releasePointer(event) {
  if (event.pointerId === stickPointer) {
    stickPointer = null;
    knob.style.transform = "";
    for (const action of ["forward", "back", "noseUp", "noseDown"]) key(action, false);
  }
  const button = pointers.get(event.pointerId);
  pointers.delete(event.pointerId);
  if (button && ![...pointers.values()].includes(button)) {
    key(button.dataset.action, false);
    button.classList.remove("held");
  }
}

for (const button of actionButtons) {
  button.addEventListener("pointerdown", event => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    pointers.set(event.pointerId, button);
    button.classList.add("held");
    key(button.dataset.action, true);
  });
}
for (const type of ["pointerup", "pointercancel", "lostpointercapture"]) {
  controls.addEventListener(type, releasePointer);
}
controls.addEventListener("contextmenu", event => event.preventDefault());
window.addEventListener("blur", releaseAll);
window.addEventListener("pagehide", releaseAll);
document.addEventListener("visibilitychange", () => { if (document.hidden) releaseAll(); });
screen.orientation?.addEventListener("change", releaseAll);

fullscreen.hidden = !document.fullscreenEnabled;
fullscreen.addEventListener("click", async () => {
  try {
    if (document.fullscreenElement) await document.exitFullscreen();
    else {
      await arena.requestFullscreen();
      await screen.orientation?.lock?.("landscape");
    }
  } catch { /* Orientation locking is optional on mobile browsers. */ }
});
document.addEventListener("fullscreenchange", () => {
  const label = document.fullscreenElement ? "退出全屏" : "全屏";
  fullscreen.title = label;
  fullscreen.setAttribute("aria-label", label);
});

async function start() {
  try {
    player = window.RufflePlayer.newest().createPlayer();
    document.querySelector("#stage").append(player);
    await player.ruffle().load({
      url: "./touch-player.swf", autoplay: "on", allowScriptAccess: true,
      letterbox: "on", scale: "showAll", openUrlMode: "deny", contextMenu: "off",
      splashScreen: false, unmuteOverlay: "hidden", backgroundColor: "#10151b",
    });
    player.focus({preventScroll: true});
  } catch { gameLoadFailed(); }
}
start();
