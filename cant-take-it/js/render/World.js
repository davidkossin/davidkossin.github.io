/**
 * Tilemap helpers + Decision Room / Hallway builders.
 */

import { TILE, VIEW_W, VIEW_H, PALETTE } from '../config.js';
import { makeTile, makeDoor, makeLamp, makeTellerWindow } from './Assets.js';

export function buildDecisionRoom() {
  // 20×14 tiles
  const cols = 20;
  const rows = 14;
  const map = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      if (y === 0 || y === rows - 1 || x === 0 || x === cols - 1) row.push('wall');
      else if (y >= 5 && y <= 9 && x >= 4 && x <= 15) row.push('carpet');
      else row.push('floor');
    }
    map.push(row);
  }
  // North door opening
  map[0][9] = 'floor';
  map[0][10] = 'floor';

  const interactables = [
    {
      id: 'door-hallway',
      x: 9 * TILE,
      y: 0 * TILE,
      w: 2 * TILE,
      h: TILE,
      label: 'Hallway of Time',
      kind: 'door',
    },
    {
      id: 'teller-home',
      x: 3 * TILE,
      y: 3 * TILE,
      w: 32,
      h: 24,
      label: 'Buy / Sell Home',
      kind: 'teller',
      action: 'home',
    },
    {
      id: 'teller-stock',
      x: 7 * TILE,
      y: 3 * TILE,
      w: 32,
      h: 24,
      label: 'Sell Stock',
      kind: 'teller',
      action: 'stock',
    },
    {
      id: 'teller-job',
      x: 11 * TILE,
      y: 3 * TILE,
      w: 32,
      h: 24,
      label: 'Job / Retire',
      kind: 'teller',
      action: 'job',
    },
    {
      id: 'teller-kid',
      x: 15 * TILE,
      y: 3 * TILE,
      w: 32,
      h: 24,
      label: 'Have a Kid',
      kind: 'teller',
      action: 'kid',
    },
    {
      id: 'teller-buy',
      x: 9 * TILE,
      y: 10 * TILE,
      w: 32,
      h: 24,
      label: 'Large Purchase',
      kind: 'teller',
      action: 'purchase',
    },
  ];

  return {
    cols,
    rows,
    map,
    interactables,
    spawn: { x: 10 * TILE - 6, y: 8 * TILE },
    width: cols * TILE,
    height: rows * TILE,
  };
}

/**
 * Hallway: long north path.
 * Left = year markers, right = doors per year, lamps every 5 years.
 * @param {number} doorCount - typically 100 - startAge
 * @param {number} startYear
 * @param {number} startAge
 */
export function buildHallway(doorCount, startYear, startAge) {
  const cols = 12;
  // south foyer + one segment per year + north end chamber
  const segment = 4; // tiles per year along Y (going north = decreasing y conceptually; we'll use increasing y south→north by flipping draw)
  // Actually: player walks NORTH (decreasing world Y) toward age 100.
  // So year 0 (start) at south (high Y), age 100 at north (low Y).
  const foyer = 6;
  const endPad = 8;
  const rows = foyer + doorCount * segment + endPad;
  const map = [];
  for (let y = 0; y < rows; y++) {
    const row = [];
    for (let x = 0; x < cols; x++) {
      if (x === 0 || x === cols - 1) row.push('wall');
      else if (y === 0 || y === rows - 1) row.push('wall');
      else row.push('stone');
    }
    map.push(row);
  }

  // south entrance opening (from decision room)
  map[rows - 1][5] = 'stone';
  map[rows - 1][6] = 'stone';
  // north end opening
  map[0][5] = 'stone';
  map[0][6] = 'stone';

  const interactables = [];
  const doors = [];

  // Year doors: index 0 = start year (southernmost), last = year before 100
  for (let i = 0; i < doorCount; i++) {
    const year = startYear + i;
    const age = startAge + i;
    // y position: from south going north
    const yTile = rows - 1 - foyer - i * segment - 1;
    // right side door
    const door = {
      id: `year-door-${year}`,
      x: (cols - 2) * TILE - 4,
      y: yTile * TILE,
      w: 16,
      h: 24,
      label: `Year ${year} (age ${age})`,
      kind: 'year-door',
      year,
      age,
      yearIndex: i,
    };
    doors.push(door);
    interactables.push(door);

    // left timeline marker (visual only)
    interactables.push({
      id: `marker-${year}`,
      x: TILE + 2,
      y: yTile * TILE + 4,
      w: 12,
      h: 12,
      label: String(year),
      kind: 'marker',
      year,
      age,
    });

    if (i % 5 === 0) {
      interactables.push({
        id: `lamp-${year}`,
        x: 3 * TILE,
        y: yTile * TILE,
        w: 16,
        h: 16,
        kind: 'lamp',
        year,
      });
    }
  }

  // End of the Line door at north
  interactables.push({
    id: 'end-door',
    x: 5 * TILE,
    y: TILE,
    w: 2 * TILE,
    h: TILE + 8,
    label: 'End of the Line',
    kind: 'end-door',
  });

  // South return door (back tip — optional, mostly spawn)
  interactables.push({
    id: 'south-entry',
    x: 5 * TILE,
    y: (rows - 2) * TILE,
    w: 2 * TILE,
    h: TILE,
    kind: 'spawn',
  });

  return {
    cols,
    rows,
    map,
    interactables,
    doors,
    doorCount,
    segment,
    foyer,
    endPad,
    startYear,
    startAge,
    spawn: { x: 6 * TILE - 6, y: (rows - 3) * TILE },
    width: cols * TILE,
    height: rows * TILE,
    /** progress 0 at south (start) → 1 at north (age 100) */
    progressAtY(y) {
      const south = (rows - foyer) * TILE;
      const north = endPad * TILE;
      const t = (south - y) / (south - north);
      return Math.max(0, Math.min(1, t));
    },
  };
}

export function drawWorld(ctx, world, camX, camY) {
  const tiles = {
    floor: makeTile('floor'),
    wall: makeTile('wall'),
    wood: makeTile('wood'),
    grass: makeTile('grass'),
    stone: makeTile('stone'),
    carpet: makeTile('carpet'),
  };

  const startCol = Math.max(0, Math.floor(camX / TILE) - 1);
  const startRow = Math.max(0, Math.floor(camY / TILE) - 1);
  const endCol = Math.min(world.cols, Math.ceil((camX + VIEW_W) / TILE) + 1);
  const endRow = Math.min(world.rows, Math.ceil((camY + VIEW_H) / TILE) + 1);

  for (let y = startRow; y < endRow; y++) {
    for (let x = startCol; x < endCol; x++) {
      const t = world.map[y][x];
      const img = tiles[t] || tiles.floor;
      ctx.drawImage(img, x * TILE - camX, y * TILE - camY);
    }
  }

  const doorSpr = makeDoor(true);
  const lampSpr = makeLamp();
  const tellerSpr = makeTellerWindow();

  for (const obj of world.interactables) {
    const sx = obj.x - camX;
    const sy = obj.y - camY;
    if (sx < -40 || sy < -40 || sx > VIEW_W + 40 || sy > VIEW_H + 40) continue;

    if (obj.kind === 'teller') {
      ctx.drawImage(tellerSpr, sx, sy);
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillStyle = PALETTE.uiText;
      ctx.fillText(obj.label.split(' ')[0], sx + 2, sy + 26);
    } else if (obj.kind === 'year-door' || obj.kind === 'door' || obj.kind === 'end-door') {
      ctx.drawImage(doorSpr, sx, sy - 4);
    } else if (obj.kind === 'lamp') {
      ctx.drawImage(lampSpr, sx, sy);
      // glow
      ctx.fillStyle = 'rgba(255,180,40,0.12)';
      ctx.beginPath();
      ctx.arc(sx + 8, sy + 6, 18, 0, Math.PI * 2);
      ctx.fill();
    } else if (obj.kind === 'marker') {
      ctx.fillStyle = PALETTE.goldDark;
      ctx.fillRect(sx, sy, 14, 10);
      ctx.fillStyle = PALETTE.gold;
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillText(String(obj.year).slice(2), sx + 1, sy + 2);
    }
  }
}

export function isSolid(world, x, y, w, h) {
  // check corners of AABB against wall tiles
  const points = [
    [x, y],
    [x + w - 1, y],
    [x, y + h - 1],
    [x + w - 1, y + h - 1],
  ];
  for (const [px, py] of points) {
    const tx = Math.floor(px / TILE);
    const ty = Math.floor(py / TILE);
    if (ty < 0 || tx < 0 || ty >= world.rows || tx >= world.cols) return true;
    if (world.map[ty][tx] === 'wall') return true;
  }
  return false;
}

export function findFacingInteractable(player, world, range = 20) {
  const c = player.center();
  let best = null;
  let bestDist = range;
  for (const obj of world.interactables) {
    if (obj.kind === 'marker' || obj.kind === 'lamp' || obj.kind === 'spawn') continue;
    const ox = obj.x + obj.w / 2;
    const oy = obj.y + obj.h / 2;
    const d = Math.hypot(c.x - ox, c.y - oy);
    if (d < bestDist) {
      bestDist = d;
      best = obj;
    }
  }
  return best;
}
