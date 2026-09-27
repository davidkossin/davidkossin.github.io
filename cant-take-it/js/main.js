/**
 * You Can't Take It With You — bootstrap & scene loop.
 */

import { VIEW_W, VIEW_H, CANVAS_H, SCALE, KEYS } from './config.js';
import { Dialog } from './render/Dialog.js';
import { TitleScene } from './scenes/TitleScene.js';
import { SetupScene } from './scenes/SetupScene.js';
import { RoomScene } from './scenes/RoomScene.js';
import { HallwayScene } from './scenes/HallwayScene.js';
import { EndingScene } from './scenes/EndingScene.js';
import { PauseMenu } from './scenes/PauseMenu.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  const maxW = Math.min(window.innerWidth - 16, VIEW_W * SCALE * 2);
  const scale = Math.max(2, Math.floor(maxW / VIEW_W));
  canvas.width = VIEW_W;
  canvas.height = CANVAS_H;
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${CANVAS_H * scale}px`;
  ctx.imageSmoothingEnabled = false;
}

fitCanvas();
window.addEventListener('resize', fitCanvas);

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
  } else if (mode === 'ending') {
    ending.update();
    ending.render(ctx);
  }

  dialog.draw(ctx);
  if (pause.open && game) pause.draw(ctx, game);

  requestAnimationFrame(loop);
}

loop();
startTitle().catch((err) => {
  console.error(err);
  ctx.fillStyle = '#c04040';
  ctx.font = '8px monospace';
  ctx.fillText('Boot error — see console', 20, 40);
});
