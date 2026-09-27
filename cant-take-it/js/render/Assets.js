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

/** 16×24 player facing down, with hair color/length and gray factor 0..1 */
export function makePlayerSprite(hairColor = 'dark', hairLength = 'short', gray = 0) {
  const key = `player-${hairColor}-${hairLength}-${gray.toFixed(2)}`;
  if (cache.has(key)) return cache.get(key);

  const c = canvas(16, 24);
  const ctx = c.getContext('2d');
  const base = HAIR_COLORS[hairColor] || HAIR_COLORS.dark;
  const hair = mixHex(base, PALETTE.hairGray, gray);

  // shadow
  px(ctx, 4, 22, 'rgba(0,0,0,0.35)', 8, 2);

  // boots
  px(ctx, 4, 20, '#2a2018', 3, 2);
  px(ctx, 9, 20, '#2a2018', 3, 2);

  // legs
  px(ctx, 5, 16, PALETTE.pants, 3, 4);
  px(ctx, 8, 16, PALETTE.pants, 3, 4);

  // torso
  px(ctx, 4, 10, PALETTE.shirt, 8, 6);
  px(ctx, 3, 11, PALETTE.shirt, 1, 4);
  px(ctx, 12, 11, PALETTE.shirt, 1, 4);

  // head
  px(ctx, 5, 4, PALETTE.skin, 6, 6);
  px(ctx, 6, 5, PALETTE.skinDark, 1, 1); // eye L
  px(ctx, 9, 5, PALETTE.skinDark, 1, 1); // eye R

  // hair
  if (hairLength === 'long') {
    px(ctx, 4, 3, hair, 8, 3);
    px(ctx, 3, 5, hair, 2, 6);
    px(ctx, 11, 5, hair, 2, 6);
    px(ctx, 5, 2, hair, 6, 1);
  } else {
    px(ctx, 5, 2, hair, 6, 3);
    px(ctx, 4, 3, hair, 1, 2);
    px(ctx, 11, 3, hair, 1, 2);
  }

  // belt
  px(ctx, 4, 15, PALETTE.goldDark, 8, 1);

  cache.set(key, c);
  return c;
}

export function makeTile(type) {
  const key = `tile-${type}`;
  if (cache.has(key)) return cache.get(key);
  const c = canvas(TILE, TILE);
  const ctx = c.getContext('2d');

  if (type === 'floor') {
    ctx.fillStyle = PALETTE.floor;
    ctx.fillRect(0, 0, 16, 16);
    // dither
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
    px(ctx, 12, 12, PALETTE.gold, 2, 2); // knob
  } else {
    px(ctx, 2, 0, '#1a1010', 12, 24);
  }
  cache.set(key, c);
  return c;
}

export function makeLamp() {
  if (cache.has('lamp')) return cache.get('lamp');
  const c = canvas(16, 16);
  const ctx = c.getContext('2d');
  px(ctx, 7, 12, '#3a2a18', 2, 4); // pole
  px(ctx, 5, 4, PALETTE.lamp, 6, 6);
  px(ctx, 6, 5, '#fff0c0', 4, 4);
  px(ctx, 4, 3, PALETTE.goldDark, 8, 1);
  cache.set('lamp', c);
  return c;
}

export function makeTellerWindow() {
  if (cache.has('teller')) return cache.get('teller');
  const c = canvas(32, 24);
  const ctx = c.getContext('2d');
  px(ctx, 0, 8, PALETTE.woodDark, 32, 16);
  px(ctx, 2, 0, PALETTE.wood, 28, 12);
  px(ctx, 4, 2, '#87a0b8', 24, 8); // glass
  px(ctx, 6, 4, '#a8c0d8', 8, 4);
  px(ctx, 12, 14, PALETTE.gold, 8, 2); // counter edge
  cache.set('teller', c);
  return c;
}

export function makeDialogChrome(w, h) {
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  // outer dark
  ctx.fillStyle = PALETTE.uiBorderDark;
  ctx.fillRect(0, 0, w, h);
  // gold border
  ctx.fillStyle = PALETTE.uiBorder;
  ctx.fillRect(2, 2, w - 4, h - 4);
  // inner dark
  ctx.fillStyle = PALETTE.uiBg;
  ctx.fillRect(4, 4, w - 8, h - 8);
  // corner ornaments
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
