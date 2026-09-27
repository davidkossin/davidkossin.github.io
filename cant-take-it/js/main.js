/**
 * You Can't Take It With You — bootstrap & scene loop.
 */

import { VIEW_W, VIEW_H, SCALE, KEYS } from './config.js';
import { Dialog } from './render/Dialog.js';
import { TitleScene } from './scenes/TitleScene.js';
import { SetupScene } from './scenes/SetupScene.js';
import { RoomScene } from './scenes/RoomScene.js';
import { HallwayScene } from './scenes/HallwayScene.js';
import { EndingScene } from './scenes/EndingScene.js';

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');

function fitCanvas() {
  const maxW = Math.min(window.innerWidth - 16, VIEW_W * SCALE * 2);
  const scale = Math.max(2, Math.floor(maxW / VIEW_W));
  canvas.width = VIEW_W;
  canvas.height = VIEW_H;
  canvas.style.width = `${VIEW_W * scale}px`;
  canvas.style.height = `${VIEW_H * scale}px`;
  ctx.imageSmoothingEnabled = false;
}

fitCanvas();
window.addEventListener('resize', fitCanvas);

const dialog = new Dialog();
const title = new TitleScene({ });
const setup = new SetupScene();
const room = new RoomScene();
const hallway = new HallwayScene();
const ending = new EndingScene();

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
  await waitForConfirm();
  const result = await title.runMenu(dialog);
  if (result.action === 'load') {
    game = result.game;
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

function wait(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

window.addEventListener('keydown', async (e) => {
  if (dialog.active) {
    dialog.handleKeyDown(e);
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
    ending.enter();
    game.scene = 'ending';
  }
}

function loop() {
  ctx.fillStyle = '#0a0810';
  ctx.fillRect(0, 0, VIEW_W, VIEW_H);
  ctx.imageSmoothingEnabled = false;

  if (mode === 'title') {
    title.update();
    title.draw(ctx);
  } else if (mode === 'setup') {
    setup.draw(ctx);
  } else if (mode === 'room' && game) {
    room.update(game, dialog);
    room.render(ctx, game);
  } else if (mode === 'hallway' && game) {
    hallway.update(game);
    hallway.render(ctx, game);
  } else if (mode === 'ending') {
    ending.update();
    ending.render(ctx);
  }

  dialog.draw(ctx);
  requestAnimationFrame(loop);
}

loop();
startTitle().catch((err) => {
  console.error(err);
  ctx.fillStyle = '#c04040';
  ctx.font = '8px monospace';
  ctx.fillText('Boot error — see console', 20, 40);
});
