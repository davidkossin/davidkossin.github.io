/**
 * Procedural LTTP-inspired pixel sprites (canvas → Image / pattern).
 * No Nintendo assets — original tiny sprites in muted earthy palette.
 */

import { PALETTE, HAIR_COLORS, TILE } from '../config.js';

const cache = new Map();

function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function px(ctx, x, y, color, w = 1, h = 1) {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

/**
 * 16×24 player walk frame.
 * @param {'down'|'up'|'left'|'right'} facing
 * @param {number} frame 0..3
 */
export function makePlayerSprite(
  hairColor = 'dark',
  hairLength = 'short',
  gray = 0,
  facing = 'down',
  frame = 0
) {
  const key = `player-${hairColor}-${hairLength}-${gray.toFixed(2)}-${facing}-${frame}`;
  if (cache.has(key)) return cache.get(key);

  const c = canvas(16, 24);
  const ctx = c.getContext('2d');
  const base = HAIR_COLORS[hairColor] || HAIR_COLORS.dark;
  const hair = mixHex(base, PALETTE.hairGray, gray);
  const f = frame % 4;
  // leg swing / bob offsets
  const legPhase = f === 1 || f === 3 ? (f === 1 ? 1 : -1) : 0;
  const bob = f === 1 || f === 3 ? -1 : 0;

  // shadow
  px(ctx, 4, 22, 'rgba(0,0,0,0.35)', 8, 2);

  if (facing === 'left' || facing === 'right') {
    const flip = facing === 'left';
    drawSide(ctx, hair, hairLength, bob, legPhase, flip);
  } else if (facing === 'up') {
    drawUp(ctx, hair, hairLength, bob, legPhase);
  } else {
    drawDown(ctx, hair, hairLength, bob, legPhase);
  }

  cache.set(key, c);
  return c;
}

function drawDown(ctx, hair, hairLength, bob, legPhase) {
  px(ctx, 4, 20 + bob, '#2a2018', 3, 2);
  px(ctx, 9, 20 + bob, '#2a2018', 3, 2);
  px(ctx, 5, 16 + bob, PALETTE.pants, 3, 4);
  px(ctx, 8 + legPhase, 16 + bob, PALETTE.pants, 3, 4);
  px(ctx, 4, 10 + bob, PALETTE.shirt, 8, 6);
  px(ctx, 3, 11 + bob, PALETTE.shirt, 1, 4);
  px(ctx, 12, 11 + bob, PALETTE.shirt, 1, 4);
  px(ctx, 5, 4 + bob, PALETTE.skin, 6, 6);
  px(ctx, 6, 5 + bob, PALETTE.skinDark, 1, 1);
  px(ctx, 9, 5 + bob, PALETTE.skinDark, 1, 1);
  if (hairLength === 'long') {
    px(ctx, 4, 3 + bob, hair, 8, 3);
    px(ctx, 3, 5 + bob, hair, 2, 6);
    px(ctx, 11, 5 + bob, hair, 2, 6);
    px(ctx, 5, 2 + bob, hair, 6, 1);
  } else {
    px(ctx, 5, 2 + bob, hair, 6, 3);
    px(ctx, 4, 3 + bob, hair, 1, 2);
    px(ctx, 11, 3 + bob, hair, 1, 2);
  }
  px(ctx, 4, 15 + bob, PALETTE.goldDark, 8, 1);
}

function drawUp(ctx, hair, hairLength, bob, legPhase) {
  px(ctx, 4, 20 + bob, '#2a2018', 3, 2);
  px(ctx, 9, 20 + bob, '#2a2018', 3, 2);
  px(ctx, 5 + legPhase, 16 + bob, PALETTE.pants, 3, 4);
  px(ctx, 8, 16 + bob, PALETTE.pants, 3, 4);
  px(ctx, 4, 10 + bob, PALETTE.shirt, 8, 6);
  // hair covers face from behind
  if (hairLength === 'long') {
    px(ctx, 4, 2 + bob, hair, 8, 8);
    px(ctx, 3, 5 + bob, hair, 2, 6);
    px(ctx, 11, 5 + bob, hair, 2, 6);
  } else {
    px(ctx, 5, 2 + bob, hair, 6, 5);
    px(ctx, 4, 3 + bob, hair, 1, 3);
    px(ctx, 11, 3 + bob, hair, 1, 3);
  }
  px(ctx, 4, 15 + bob, PALETTE.goldDark, 8, 1);
}

function drawSide(ctx, hair, hairLength, bob, legPhase, flip) {
  const m = (x) => (flip ? 15 - x : x);
  const mw = (x, w) => (flip ? 15 - x - w + 1 : x);
  px(ctx, mw(5, 3), 20 + bob, '#2a2018', 3, 2);
  px(ctx, mw(5 + legPhase, 3), 16 + bob, PALETTE.pants, 3, 4);
  px(ctx, mw(4, 7), 10 + bob, PALETTE.shirt, 7, 6);
  px(ctx, mw(5, 5), 4 + bob, PALETTE.skin, 5, 6);
  px(ctx, m(flip ? 6 : 8), 5 + bob, PALETTE.skinDark, 1, 1);
  if (hairLength === 'long') {
    px(ctx, mw(4, 7), 2 + bob, hair, 7, 4);
    px(ctx, mw(3, 2), 5 + bob, hair, 2, 7);
  } else {
    px(ctx, mw(4, 6), 2 + bob, hair, 6, 3);
  }
  px(ctx, mw(4, 7), 15 + bob, PALETTE.goldDark, 7, 1);
}

export function makeTile(type) {
  const key = `tile-${type}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(TILE, TILE);
  const ctx = c.getContext('2d');

  if (type === 'floor') {
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(0, 0, 16, 16);
    for (let y = 0; y < 16; y += 2) {
      for (let x = (y / 2) % 2; x < 16; x += 2) {
        px(ctx, x, y, PALETTE.floorDark);
      }
    }
    px(ctx, 3, 5, PALETTE.floorLight);
    px(ctx, 11, 10, PALETTE.floorLight);
  } else if (type === 'wall') {
    ctx.fillStyle = PALETTE.wall;
    ctx.fillRect(0, 0, 16, 16);
    px(ctx, 0, 0, PALETTE.wallEdge, 16, 2);
    px(ctx, 0, 14, PALETTE.wallEdge, 16, 2);
    px(ctx, 2, 4, PALETTE.floorLight, 3, 2);
    px(ctx, 10, 8, PALETTE.floorDark, 4, 2);
  } else if (type === 'wallPurple') {
    ctx.fillStyle = PALETTE.wallPurple;
    ctx.fillRect(0, 0, 16, 16);
    px(ctx, 0, 0, PALETTE.wallPurpleEdge, 16, 3);
    px(ctx, 0, 13, PALETTE.wallPurpleEdge, 16, 3);
    px(ctx, 0, 0, PALETTE.wallPurpleLite, 2, 16);
    px(ctx, 14, 0, PALETTE.wallPurpleEdge, 2, 16);
    px(ctx, 3, 5, PALETTE.wallPurpleLite, 4, 2);
    px(ctx, 9, 9, '#2a1a38', 5, 3);
  } else if (type === 'void') {
    ctx.fillStyle = PALETTE.void;
    ctx.fillRect(0, 0, 16, 16);
    // dense stipple
    for (let y = 0; y < 16; y++) {
      for (let x = (y % 2); x < 16; x += 2) {
        px(ctx, x, y, PALETTE.voidDot);
      }
    }
    // occasional deeper dots
    px(ctx, 3, 7, PALETTE.voidDeep);
    px(ctx, 11, 2, PALETTE.voidDeep);
    px(ctx, 8, 13, PALETTE.voidDeep);
  } else if (type === 'wood') {
    ctx.fillStyle = PALETTE.wood;
    ctx.fillRect(0, 0, 16, 16);
    px(ctx, 0, 4, PALETTE.woodDark, 16, 1);
    px(ctx, 0, 10, PALETTE.woodDark, 16, 1);
    px(ctx, 7, 0, PALETTE.woodDark, 1, 16);
  } else if (type === 'grass') {
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(0, 0, 16, 16);
    for (let i = 0; i < 8; i++) {
      px(ctx, (i * 5) % 16, (i * 7) % 16, PALETTE.grassDark, 1, 2);
    }
  } else if (type === 'stone') {
    ctx.fillStyle = PALETTE.stone;
    ctx.fillRect(0, 0, 16, 16);
    px(ctx, 1, 1, PALETTE.stoneDark, 6, 6);
    px(ctx, 9, 8, PALETTE.stoneDark, 5, 5);
    px(ctx, 0, 0, '#888890', 16, 1);
  } else if (type === 'carpet') {
    ctx.fillStyle = '#5a3040';
    ctx.fillRect(0, 0, 16, 16);
    for (let y = 0; y < 16; y += 2) {
      for (let x = (y / 2) % 2; x < 16; x += 2) {
        px(ctx, x, y, '#4a2434');
      }
    }
    px(ctx, 0, 0, '#8a5060', 16, 1);
    px(ctx, 0, 15, '#8a5060', 16, 1);
  } else {
    ctx.fillStyle = '#ff00ff';
    ctx.fillRect(0, 0, 16, 16);
  }

  cache.set(key, c);
  return c;
}

export function makeDoor(frame = true) {
  const key = `door-${frame}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(16, 24);
  const ctx = c.getContext('2d');
  if (frame) {
    px(ctx, 0, 0, PALETTE.woodDark, 16, 24);
    px(ctx, 2, 2, PALETTE.wood, 12, 20);
    px(ctx, 12, 12, PALETTE.gold, 2, 2);
  } else {
    px(ctx, 2, 0, '#1a1010', 12, 24);
  }
  cache.set(key, c);
  return c;
}

/** Flickering lantern — frame 0..3 */
export function makeLamp(frame = 0) {
  const f = frame % 4;
  const key = `lamp-${f}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(16, 16);
  const ctx = c.getContext('2d');
  px(ctx, 7, 12, '#3a2a18', 2, 4);
  px(ctx, 5, 4, PALETTE.goldDark, 6, 1);
  // flame flicker
  const flame = ['#ffcc66', '#ffaa22', '#ffe088', '#ff8822'][f];
  const core = ['#fff0c0', '#ffe8a0', '#ffffff', '#ffd080'][f];
  const h = 5 + (f % 2);
  px(ctx, 6, 5, flame, 4, h);
  px(ctx, 7, 6, core, 2, Math.max(2, h - 2));
  if (f === 1 || f === 3) px(ctx, 8, 4, flame, 1, 1);
  cache.set(key, c);
  return c;
}

/** Blue-flame wall torch — frame 0..3 (cool cyan vs red lanterns). */
export function makeBlueTorch(frame = 0) {
  const f = frame % 4;
  const key = `bluetorch-${f}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(16, 16);
  const ctx = c.getContext('2d');
  // iron bracket / haft
  px(ctx, 7, 11, '#2a2a38', 2, 5);
  px(ctx, 5, 10, '#3a3a4a', 6, 2);
  px(ctx, 4, 9, '#4a4a5a', 8, 1);
  // cool flame
  const flame = ['#66ccff', '#4488ff', '#88e0ff', '#3366ee'][f];
  const core = ['#e8ffff', '#c0f0ff', '#ffffff', '#a0d8ff'][f];
  const h = 5 + (f % 2);
  px(ctx, 6, 4, flame, 4, h);
  px(ctx, 7, 5, core, 2, Math.max(2, h - 2));
  if (f === 1 || f === 3) px(ctx, 5, 3, flame, 1, 2);
  if (f === 0 || f === 2) px(ctx, 10, 3, flame, 1, 2);
  // tip spark
  if (f % 2 === 0) px(ctx, 7, 2, '#ffffff', 2, 1);
  cache.set(key, c);
  return c;
}

/** Wall-embedded bank teller window (not freestanding desk). */
export function makeTellerWindow() {
  if (cache.has('teller-wall')) return cache.get('teller-wall');
  const c = canvas(32, 24);
  const ctx = c.getContext('2d');
  // wall recess
  px(ctx, 0, 0, PALETTE.wallEdge, 32, 24);
  px(ctx, 1, 1, PALETTE.wall, 30, 22);
  // wood frame
  px(ctx, 3, 3, PALETTE.woodDark, 26, 16);
  px(ctx, 4, 4, PALETTE.wood, 24, 14);
  // glass pane
  px(ctx, 6, 5, '#5a7890', 20, 10);
  px(ctx, 7, 6, '#87a0b8', 8, 5);
  px(ctx, 16, 8, '#a8c0d8', 6, 3);
  // sill / counter lip
  px(ctx, 2, 18, PALETTE.woodDark, 28, 4);
  px(ctx, 4, 19, PALETTE.gold, 24, 1);
  cache.set('teller-wall', c);
  return c;
}

/**
 * Clear 14×14 LTTP-scale icon for a teller action (drawn on the window pane).
 * @param {'home'|'stock'|'kid'|'purchase'|'job'} action
 */
export function makeTellerIcon(action) {
  const key = `teller-icon-${action}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(14, 14);
  const ctx = c.getContext('2d');
  // subtle pane tint behind icon
  px(ctx, 0, 0, 'rgba(20,24,36,0.35)', 14, 14);

  if (action === 'home') {
    // small house
    px(ctx, 2, 7, '#6a5030', 10, 6);       // body
    px(ctx, 3, 8, '#8b6914', 8, 4);
    px(ctx, 1, 7, '#5c4510', 12, 1);        // eaves
    px(ctx, 3, 4, '#a03828', 8, 3);         // roof
    px(ctx, 4, 3, '#a03828', 6, 1);
    px(ctx, 5, 2, '#882820', 4, 1);
    px(ctx, 6, 9, '#3a2a18', 2, 4);         // door
    px(ctx, 4, 9, '#87a0b8', 2, 2);         // window
    px(ctx, 8, 9, '#87a0b8', 2, 2);
  } else if (action === 'stock') {
    // chart with up arrow / coin
    px(ctx, 1, 12, PALETTE.goldDark, 12, 1); // axis
    px(ctx, 2, 10, '#3868a0', 2, 2);
    px(ctx, 4, 8, '#3868a0', 2, 4);
    px(ctx, 6, 6, '#4880b0', 2, 6);
    px(ctx, 8, 4, '#58a0c8', 2, 8);
    px(ctx, 10, 2, PALETTE.gold, 2, 10);
    // arrow tip
    px(ctx, 9, 2, PALETTE.gold, 4, 1);
    px(ctx, 11, 3, PALETTE.gold, 2, 1);
    px(ctx, 12, 4, PALETTE.gold, 1, 1);
  } else if (action === 'kid') {
    // child silhouette (smaller person)
    px(ctx, 5, 1, PALETTE.skin, 4, 3);      // head
    px(ctx, 6, 0, '#d4b060', 2, 1);         // hair
    px(ctx, 4, 4, '#c86878', 6, 5);         // shirt
    px(ctx, 4, 9, '#2a3a58', 2, 4);         // legs
    px(ctx, 8, 9, '#2a3a58', 2, 4);
    px(ctx, 3, 5, PALETTE.skin, 1, 2);      // arms
    px(ctx, 10, 5, PALETTE.skin, 1, 2);
  } else if (action === 'purchase') {
    // shopping bag
    px(ctx, 3, 5, '#5a3a68', 8, 8);         // bag body
    px(ctx, 4, 6, '#7a5088', 6, 6);
    px(ctx, 5, 2, PALETTE.goldDark, 1, 4);  // handles
    px(ctx, 8, 2, PALETTE.goldDark, 1, 4);
    px(ctx, 5, 2, PALETTE.gold, 4, 1);
    px(ctx, 6, 8, PALETTE.gold, 2, 2);      // emblem
  } else if (action === 'job') {
    // briefcase
    px(ctx, 1, 5, '#2a3a58', 12, 7);
    px(ctx, 2, 6, '#3a5a78', 10, 5);
    px(ctx, 5, 3, '#2a3a58', 4, 2);         // handle
    px(ctx, 6, 2, '#3a5a78', 2, 1);
    px(ctx, 5, 8, PALETTE.gold, 4, 1);      // clasp
    px(ctx, 6, 7, PALETTE.gold, 2, 1);
  } else {
    px(ctx, 5, 5, PALETTE.gold, 4, 4);
  }

  cache.set(key, c);
  return c;
}

/** Tiny HUD icons: age, year, bank, portfolio, salary */
export function makeHudIcon(kind) {
  const key = `hudicon-${kind}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(8, 8);
  const ctx = c.getContext('2d');
  if (kind === 'age') {
    // person silhouette
    px(ctx, 3, 0, PALETTE.skin, 2, 2);
    px(ctx, 2, 2, '#3868a0', 4, 3);
    px(ctx, 2, 5, '#2a3a58', 1, 3);
    px(ctx, 5, 5, '#2a3a58', 1, 3);
  } else if (kind === 'year') {
    // calendar
    px(ctx, 1, 1, PALETTE.gold, 6, 6);
    px(ctx, 2, 2, '#181818', 4, 4);
    px(ctx, 2, 0, PALETTE.goldDark, 1, 2);
    px(ctx, 5, 0, PALETTE.goldDark, 1, 2);
  } else if (kind === 'bank') {
    // coin / cash
    px(ctx, 1, 1, PALETTE.gold, 6, 6);
    px(ctx, 2, 2, PALETTE.goldDark, 4, 4);
    px(ctx, 3, 3, PALETTE.gold, 2, 2);
  } else if (kind === 'portfolio') {
    // bag / chest
    px(ctx, 1, 3, '#8a6830', 6, 4);
    px(ctx, 2, 2, PALETTE.gold, 4, 1);
    px(ctx, 3, 4, PALETTE.gold, 2, 1);
  } else if (kind === 'salary') {
    // briefcase
    px(ctx, 1, 2, '#3a5a78', 6, 5);
    px(ctx, 3, 1, '#2a3a58', 2, 1);
    px(ctx, 2, 4, PALETTE.gold, 4, 1);
  }
  cache.set(key, c);
  return c;
}

/** Small gold-framed item box like LTTP */
export function makeHudBox(w, h) {
  const key = `hudbox-${w}x${h}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = PALETTE.uiBorder;
  ctx.lineWidth = 1;
  ctx.strokeRect(0.5, 0.5, w - 1, h - 1);
  ctx.strokeStyle = PALETTE.uiBorderDark;
  ctx.strokeRect(1.5, 1.5, w - 3, h - 3);
  cache.set(key, c);
  return c;
}

export function makeDialogChrome(w, h) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  ctx.fillStyle = PALETTE.uiBorderDark;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = PALETTE.uiBorder;
  ctx.fillRect(2, 2, w - 4, h - 4);
  ctx.fillStyle = PALETTE.uiBg;
  ctx.fillRect(4, 4, w - 8, h - 8);
  const o = PALETTE.gold;
  px(ctx, 3, 3, o, 3, 1);
  px(ctx, 3, 3, o, 1, 3);
  px(ctx, w - 6, 3, o, 3, 1);
  px(ctx, w - 4, 3, o, 1, 3);
  px(ctx, 3, h - 4, o, 3, 1);
  px(ctx, 3, h - 6, o, 1, 3);
  px(ctx, w - 6, h - 4, o, 3, 1);
  px(ctx, w - 4, h - 6, o, 1, 3);
  return c;
}

function mixHex(a, b, t) {
  const pa = hexToRgb(a);
  const pb = hexToRgb(b);
  const r = Math.round(pa.r + (pb.r - pa.r) * t);
  const g = Math.round(pa.g + (pb.g - pa.g) * t);
  const bl = Math.round(pa.b + (pb.b - pa.b) * t);
  return `rgb(${r},${g},${bl})`;
}

function hexToRgb(hex) {
  const h = hex.replace('#', '');
  return {
    r: parseInt(h.slice(0, 2), 16),
    g: parseInt(h.slice(2, 4), 16),
    b: parseInt(h.slice(4, 6), 16),
  };
}

export function clearAssetCache() {
  cache.clear();
}
