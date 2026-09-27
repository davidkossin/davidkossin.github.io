import { VIEW_W, VIEW_H, HUD_H, MAX_AGE, TILE } from '../config.js';
import { Player } from '../render/Player.js';
import { Hud } from '../render/Hud.js';
import {
  buildHallway,
  drawWorld,
  isSolid,
  findFacingInteractable,
} from '../render/World.js';
import { projectYears, computeWorth, cloneState } from '../finance/Engine.js';
import { currentNode, enterYearRoom, commitHallwayNode } from '../state/GameState.js';
import { autoSave } from '../state/SaveSystem.js';

export class HallwayScene {
  constructor() {
    this.world = null;
    this.player = null;
    this.hud = new Hud();
    this.prompt = null;
    this.baseline = null;
    /** @type {Array<{state:object, worth:object, events?:string[]}>} */
    this.snapshots = [];
    /** @type {Array<{y:number, year:number, age:number, messages:string[]}>} */
    this.eventAuras = [];
    this.eventBanner = null;
    this.visual = null;
    this.animTime = 0;
    this.leaveYear = 0;
    this.leaveAge = 0;
  }

  enter(game) {
    const node = currentNode(game);
    // Prefer committed end-of-room baseline; fall back to live portfolio
    this.baseline = node?.baseline
      ? node.baseline
      : node?.snapshotId
        ? game.timeline.snapshots[node.snapshotId]
        : cloneState(game.portfolio);
    if (!this.baseline) this.baseline = cloneState(game.portfolio);

    // Sync portfolio to baseline when entering hallway
    game.portfolio = cloneState(this.baseline);

    this.leaveYear = this.baseline.year;
    this.leaveAge = this.baseline.age;

    // Doors always start at last Decision Room year + 1
    const firstDoorYear = this.leaveYear + 1;
    const firstDoorAge = this.leaveAge + 1;
    const doorCount = Math.max(0, MAX_AGE - this.leaveAge - 1); // ages firstDoorAge .. 99

    this.world = buildHallway(doorCount, firstDoorYear, firstDoorAge);
    // Faster movement in hallway
    this.player = new Player(this.world.spawn.x, this.world.spawn.y, { speed: 2.4 });
    this.player.bindInput();
    this.prompt = null;
    this.animTime = 0;

    // Timeline node for pause-map jump-back (skip if already on this hallway node)
    const cur = currentNode(game);
    if (!(cur && cur.type === 'hallway' && cur.year === this.leaveYear && cur.age === this.leaveAge)) {
      commitHallwayNode(game);
    }

    // Deterministic projection — no noise so HUD doesn't jitter
    const yearsToProject = Math.max(0, MAX_AGE - this.leaveAge);
    this.snapshots = [
      { state: cloneState(this.baseline), worth: computeWorth(this.baseline), events: [] },
    ];
    if (yearsToProject > 0) {
      const snaps = projectYears(
        this.baseline,
        yearsToProject,
        game.portfolio.difficulty || this.baseline.difficulty,
        { deterministic: true }
      );
      for (const s of snaps) {
        this.snapshots.push({ state: s.state, worth: s.worth, events: s.events || [] });
      }
    }
    this.eventAuras = buildEventAuras(this.world, this.snapshots, this.leaveYear);
    this.eventBanner = null;
    this.visual = this.snapshots[0];
    autoSave(game, 'end');
  }

  leave() {
    this.player?.unbindInput();
  }

  setInputBlocked(blocked) {
    if (!this.player) return;
    if (blocked) {
      if (this.player.inputEnabled) this.player.clearKeys();
      this.player.inputEnabled = false;
    } else {
      this.player.clearKeys();
      this.player.inputEnabled = true;
    }
  }

  update(game, dialog) {
    this.animTime += 1;
    const blocked = !!dialog?.active;
    if (blocked) {
      this.setInputBlocked(true);
    } else {
      if (!this.player.inputEnabled) {
        this.player.clearKeys();
        this.player.inputEnabled = true;
      }
      this.player.update((x, y, w, h) => isSolid(this.world, x, y, w, h));
      this.prompt = findFacingInteractable(this.player, this.world, 22);
    }

    const progress = this.world.progressAtY(this.player.y);
    const maxIdx = this.snapshots.length - 1;
    const idx = Math.max(0, Math.min(maxIdx, Math.floor(progress * maxIdx)));
    this.visual = this.snapshots[idx];

    // Aura portal banner when player crosses an event band
    const py = this.player.y + this.player.h / 2;
    let best = null;
    let bestDist = 28;
    for (const aura of this.eventAuras) {
      const d = Math.abs(py - aura.y);
      if (d < bestDist) {
        bestDist = d;
        best = aura;
      }
    }
    this.eventBanner = best ? best.messages.join(' · ') : null;
  }

  stateAtDoor(yearIndex) {
    // yearIndex is 1-based years from leave (see World.buildHallway)
    const idx = Math.max(0, Math.min(this.snapshots.length - 1, yearIndex));
    return this.snapshots[idx];
  }

  async tryInteract(game, dialog) {
    const obj = findFacingInteractable(this.player, this.world, 22);
    if (!obj) return null;
    this.player?.clearKeys();
    this.setInputBlocked(true);

    if (obj.kind === 'year-door') {
      const snap = this.stateAtDoor(obj.yearIndex);
      const state = cloneState(snap.state);
      state.year = obj.year;
      state.age = obj.age;

      const ok = await dialog.confirm(
        `Enter Decision Room for ${obj.year} (age ${obj.age})?\nBranches a new timeline from projected finances.`,
        { title: 'Year Door', yes: 'Enter', no: 'Stay' }
      );
      if (!ok) {
        this.setInputBlocked(false);
        return null;
      }
      enterYearRoom(game, state);
      autoSave(game, 'begin');
      this.leave();
      return { goto: 'room' };
    }

    if (obj.kind === 'end-door') {
      const ok = await dialog.confirm('Are you prepared to leave this world?', {
        title: 'End of the Line',
        yes: "I'm not afraid",
        no: 'Not yet',
      });
      if (!ok) {
        await dialog.show('The hallway waits.', { title: 'End of the Line' });
        this.setInputBlocked(false);
        return null;
      }
      this.leave();
      return { goto: 'ending' };
    }

    this.setInputBlocked(false);
    return null;
  }

  render(ctx, game) {
    const camX = Math.max(
      0,
      Math.min(this.world.width - VIEW_W, this.player.x + 6 - VIEW_W / 2)
    );
    const camY = Math.max(
      0,
      Math.min(this.world.height - VIEW_H, this.player.y - VIEW_H / 2)
    );

    ctx.save();
    ctx.translate(0, HUD_H);
    drawWorld(ctx, this.world, camX, camY, this.animTime);
    drawEventAuras(ctx, this.world, this.eventAuras, camX, camY, this.animTime);
    ctx.save();
    ctx.translate(-camX, -camY);
    const vis = this.visual?.state || game.portfolio;
    this.player.draw(ctx, vis.hairColor, vis.hairLength, vis.age);
    ctx.restore();
    ctx.restore();

    const portfolio = this.visual?.state || game.portfolio;
    const worth = this.visual?.worth || computeWorth(portfolio);
    this.hud.draw(ctx, portfolio, worth);

    // Life-event banner (playfield bottom); prompt sits just below if both active
    if (this.eventBanner) {
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.textAlign = 'center';
      const by = this.prompt ? HUD_H + VIEW_H - 24 : HUD_H + VIEW_H - 12;
      let msg = this.eventBanner;
      while (msg.length > 1 && ctx.measureText(msg).width > VIEW_W - 20) msg = msg.slice(0, -1);
      // dark plate behind text for readability
      const tw = ctx.measureText(msg).width;
      ctx.fillStyle = 'rgba(10,8,24,0.72)';
      ctx.fillRect(VIEW_W / 2 - tw / 2 - 6, by - 2, tw + 12, 12);
      ctx.fillStyle = '#e8d8ff';
      ctx.fillText(msg, VIEW_W / 2, by);
      ctx.textAlign = 'left';
    }

    if (this.prompt) {
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = '#f0e8c8';
      ctx.textAlign = 'center';
      ctx.fillText(`[E] ${this.prompt.label}`, VIEW_W / 2, HUD_H + VIEW_H - 12);
      ctx.textAlign = 'left';
    }
  }
}

/** Major one-shot life/finance events → hallway aura portals. */
function portalMessages(events) {
  const out = [];
  for (const e of events || []) {
    if (/Mortgage paid off/i.test(e)) out.push(e.replace(/\.$/, ''));
    else if (/Loan paid off/i.test(e)) out.push(e.replace(/\.$/, ''));
    else if (/^Paid off:/i.test(e)) out.push(e.replace(/\.$/, ''));
    else if (/^Purchased /i.test(e)) out.push(e.replace(/\.$/, ''));
    else if (/^Retired/i.test(e)) out.push('Retired');
    else if (/goes to college/i.test(e)) out.push(e);
  }
  return out;
}

function buildEventAuras(world, snapshots, leaveYear) {
  const auras = [];
  const foyer = world.foyer || 5;
  const segment = world.segment || 3;
  const rows = world.rows;
  const byYear = new Map();

  const addMsgs = (yearOffset, year, age, msgs) => {
    if (!msgs?.length) return;
    const key = yearOffset;
    if (!byYear.has(key)) byYear.set(key, { year, age, messages: [] });
    const slot = byYear.get(key);
    for (const m of msgs) {
      if (!slot.messages.includes(m)) slot.messages.push(m);
    }
  };

  for (let k = 1; k < snapshots.length; k++) {
    const msgs = portalMessages(snapshots[k].events);
    const st = snapshots[k].state || {};
    addMsgs(k - 1, st.year, st.age, msgs);
  }

  // Named purchases recorded on the leave-year baseline
  const baseline = snapshots[0]?.state || {};
  for (const m of baseline.milestones || []) {
    const msg = m.message || m;
    const y = m.year ?? leaveYear;
    if (typeof msg !== 'string') continue;
    if (y === leaveYear) {
      // Just past the foyer — player sees it as they enter the corridor
      addMsgs(0, leaveYear, baseline.age, portalMessages([msg]));
    } else if (y > leaveYear) {
      const offset = y - leaveYear - 1;
      if (offset >= 0) addMsgs(offset, y, (baseline.age || 0) + (y - leaveYear), portalMessages([msg]));
    }
  }

  for (const [i, slot] of byYear.entries()) {
    const yTile = rows - 1 - foyer - i * segment - 1;
    const y = yTile * TILE + TILE / 2;
    auras.push({
      y,
      year: slot.year,
      age: slot.age,
      messages: slot.messages,
    });
  }
  return auras;
}

/**
 * Soft ethereal band across walkable floor + onto E/W wall faces.
 */
function drawEventAuras(ctx, world, auras, camX, camY, animTime) {
  if (!auras?.length) return;
  const walkLeft = world.walkLeft ?? 5;
  const walkRight = world.walkRight ?? 8;
  // Span deep into E/W walls so the portal reads as a slice through the corridor
  const x0 = walkLeft * TILE - 18;
  const x1 = (walkRight + 1) * TILE + 18;
  const w = x1 - x0;

  for (const aura of auras) {
    const sy = aura.y - camY;
    if (sy < -24 || sy > VIEW_H + 24) continue;
    const pulse = 0.55 + 0.35 * Math.sin(animTime / 12 + aura.y * 0.03);
    const sx = x0 - camX;

    // Soft bloom
    ctx.fillStyle = `rgba(160,100,255,${0.2 + pulse * 0.25})`;
    ctx.fillRect(sx, sy - 8, w, 17);
    // Violet outer band
    ctx.fillStyle = `rgba(140,90,255,${0.35 + pulse * 0.35})`;
    ctx.fillRect(sx, sy - 5, w, 11);
    // Cyan mid
    ctx.fillStyle = `rgba(80,220,255,${0.45 + pulse * 0.4})`;
    ctx.fillRect(sx, sy - 2, w, 5);
    // Hot white-gold core
    ctx.fillStyle = `rgba(255,245,200,${0.75 + pulse * 0.2})`;
    ctx.fillRect(sx, sy, w, 2);
    // Vertical wall streaks (west + east edges of band)
    const streakH = 14;
    ctx.fillStyle = `rgba(180,220,255,${0.35 + pulse * 0.3})`;
    ctx.fillRect(sx, sy - streakH / 2, 3, streakH);
    ctx.fillRect(sx + w - 3, sy - streakH / 2, 3, streakH);
  }
}
