/**
 * You Can't Take It With You — bootstrap & scene loop.
 */

import { VIEW_W, CANVAS_H, KEYS, GAME_VERSION } from './config.js';
import { Dialog } from './render/Dialog.js';
import { TitleScene } from './scenes/TitleScene.js';
import { SetupScene } from './scenes/SetupScene.js';
import { RoomScene } from './scenes/RoomScene.js';
import { HallwayScene } from './scenes/HallwayScene.js';
import { EndingScene } from './scenes/EndingScene.js';
import { PauseMenu } from './scenes/PauseMenu.js';
import { VirtualPad } from './input/VirtualPad.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function availableViewport() {
  const vv = window.visualViewport;
  if (vv) return { w: vv.width, h: vv.height };
  return { w: window.innerWidth, h: window.innerHeight };
}

function fitCanvas() {
  const { w: winW, h: winH } = availableViewport();
  const topbar = document.querySelector('.topbar');
  const hint = document.querySelector('.hint');
  const frame = document.querySelector('.frame');

  const topbarH = topbar ? topbar.getBoundingClientRect().height : 48;
  const hintStyle = hint ? getComputedStyle(hint) : null;
  const hintVisible = hint && hintStyle && hintStyle.display !== 'none';
  const hintH = hintVisible
    ? hint.getBoundingClientRect().height + (parseFloat(hintStyle.marginTop) || 0)
    : 0;

  // Frame border (each side) + modest outer padding already on body
  const border = frame ? (parseFloat(getComputedStyle(frame).borderTopWidth) || 4) : 4;
  const padX = 8;
  const padY = 8;

  const availW = Math.max(32, winW - padX * 2 - border * 2);
  const availH = Math.max(32, winH - topbarH - hintH - padY * 2 - border * 2);

  let scale = Math.min(availW / VIEW_W, availH / CANVAS_H);
  // Prefer integer scale when it wastes less than ~15% of the fitted size
  const intScale = Math.floor(scale);
  if (intScale >= 1 && scale - intScale < 0.15 * scale) {
    scale = intScale;
  }
  // Never overflow; allow fractional scales (no hard floor of 2)
  scale = Math.max(0.25, scale);

  canvas.width = VIEW_W;
  canvas.height = CANVAS_H;
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${CANVAS_H * scale}px`;
  ctx.imageSmoothingEnabled = false;
}

fitCanvas();
window.addEventListener('resize', fitCanvas);
if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', fitCanvas);
  window.visualViewport.addEventListener('scroll', fitCanvas);
}

const virtualPadEl = document.getElementById('virtual-pad');
const virtualPad = new VirtualPad(virtualPadEl);
virtualPad.mount();
// Re-fit after pad / hint visibility changes layout
requestAnimationFrame(fitCanvas);

const dialog = new Dialog();
const title = new TitleScene({});
const setup = new SetupScene();
const room = new RoomScene();
const hallway = new HallwayScene();
const ending = new EndingScene();
const pause = new PauseMenu();

/** @type {'title'|'setup'|'room'|'hallway'|'ending'} */
let mode = 'title';
/** @type {object|null} */
let game = null;
let booting = true;
let interacting = false;

function waitForConfirm() {
  return new Promise((resolve) => {
    const handler = (e) => {
      if (KEYS.confirm.includes(e.key)) {
        window.removeEventListener('keydown', handler);
        e.preventDefault();
        resolve();
      }
    };
    window.addEventListener('keydown', handler);
  });
}

async function startTitle() {
  mode = 'title';
  game = null;
  booting = true;
  pause.hide();
  await waitForConfirm();
  const result = await title.runMenu(dialog);
  if (result.action === 'load') {
    game = result.game;
    // migrate old saves lightly
    if (!game.worthHistory) game.worthHistory = [];
    if (!game.timeline.snapshots) game.timeline.snapshots = {};
    mode = game.scene === 'hallway' ? 'hallway' : 'room';
    if (mode === 'room') room.enter(game, false);
    else hallway.enter(game);
  } else {
    mode = 'setup';
    game = await setup.run(dialog);
    mode = 'room';
    room.enter(game, false);
  }
  booting = false;
}

window.addEventListener('keydown', async (e) => {
  if (dialog.active) {
    dialog.handleKeyDown(e);
    return;
  }

  if (pause.open) {
    const result = pause.handleKey(e, game);
    if (result === 'close') {
      if (mode === 'room') room.setInputBlocked(false);
      else if (mode === 'hallway') hallway.setInputBlocked(false);
    }
    if (result && typeof result === 'object' && result.jump) {
      // Restored hallway branch — re-enter hallway scene
      room.leave();
      hallway.leave();
      mode = 'hallway';
      hallway.enter(game);
      game.scene = 'hallway';
    }
    return;
  }

  if (mode === 'ending') {
    ending.handleKey(e);
    if (ending.done) {
      room.leave();
      hallway.leave();
      startTitle();
    }
    return;
  }

  if (booting || interacting) return;

  // Esc opens pause map/charts during play
  if (KEYS.cancel.includes(e.key) && (mode === 'room' || mode === 'hallway') && game) {
    e.preventDefault();
    if (mode === 'room') room.setInputBlocked(true);
    else hallway.setInputBlocked(true);
    pause.show(game);
    return;
  }

  if (KEYS.confirm.includes(e.key)) {
    e.preventDefault();
    interacting = true;
    try {
      let nav = null;
      if (mode === 'room') nav = await room.tryInteract(game, dialog);
      else if (mode === 'hallway') nav = await hallway.tryInteract(game, dialog);
      if (nav?.goto) await transition(nav.goto);
    } finally {
      interacting = false;
    }
  }
});

async function transition(to) {
  if (to === 'hallway') {
    room.leave();
    mode = 'hallway';
    hallway.enter(game);
    game.scene = 'hallway';
  } else if (to === 'room') {
    hallway.leave();
    mode = 'room';
    room.enter(game, true);
    game.scene = 'room';
  } else if (to === 'ending') {
    hallway.leave();
    mode = 'ending';
    ending.enter(game);
    game.scene = 'ending';
  }
}

function loop() {
  ctx.fillStyle = '#0a0810';
  ctx.fillRect(0, 0, VIEW_W, CANVAS_H);
  ctx.imageSmoothingEnabled = false;

  if (mode === 'title') {
    title.update();
    title.draw(ctx);
  } else if (mode === 'setup') {
    setup.draw(ctx);
  } else if (mode === 'room' && game) {
    if (!pause.open) room.update(game, dialog);
    room.render(ctx, game);
  } else if (mode === 'hallway' && game) {
    if (!pause.open) hallway.update(game, dialog);
    hallway.render(ctx, game);
    if (
      !pause.open &&
      !interacting &&
      !dialog.active &&
      !booting &&
      hallway.wantsGlassWallMessage()
    ) {
      interacting = true;
      hallway
        .showGlassWallMessage(dialog)
        .catch((err) => console.error(err))
        .finally(() => {
          interacting = false;
        });
    }
  } else if (mode === 'ending') {
    ending.update();
    ending.render(ctx);
  }

  dialog.draw(ctx);
  if (pause.open && game) pause.draw(ctx, game);

  // Build version — bottom-right, always visible for cache checks
  ctx.save();
  ctx.font = '5px "Press Start 2P", monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'bottom';
  ctx.fillStyle = 'rgba(240, 232, 200, 0.45)';
  ctx.fillText('v' + GAME_VERSION, VIEW_W - 4, CANVAS_H - 3);
  ctx.restore();

  requestAnimationFrame(loop);
}

loop();
startTitle().catch((err) => {
  console.error(err);
  ctx.fillStyle = '#c04040';
  ctx.font = '8px monospace';
  ctx.fillText('Boot error — see console', 20, 40);
});
