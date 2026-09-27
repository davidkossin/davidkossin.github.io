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
    this.eventAuras = buildEventAuras(this.world, this.snapshots);
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
    let bestDist = 18;
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
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillStyle = '#c8b0ff';
      ctx.textAlign = 'center';
      const by = this.prompt ? HUD_H + VIEW_H - 24 : HUD_H + VIEW_H - 12;
      let msg = this.eventBanner;
      while (msg.length > 1 && ctx.measureText(msg).width > VIEW_W - 16) msg = msg.slice(0, -1);
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
    else if (/^Retired/i.test(e)) out.push('Retired');
    else if (/goes to college/i.test(e)) out.push(e);
  }
  return out;
}

function buildEventAuras(world, snapshots) {
  const auras = [];
  const foyer = world.foyer || 5;
  const segment = world.segment || 3;
  const rows = world.rows;
  for (let k = 1; k < snapshots.length; k++) {
    const msgs = portalMessages(snapshots[k].events);
    if (!msgs.length) continue;
    const i = k - 1; // door index / years from leave
    const yTile = rows - 1 - foyer - i * segment - 1;
    const y = yTile * TILE + TILE / 2;
    const st = snapshots[k].state || {};
    auras.push({
      y,
      year: st.year,
      age: st.age,
      messages: msgs,
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
  const x0 = walkLeft * TILE - 10; // into west wall
  const x1 = (walkRight + 1) * TILE + 10; // into east wall
  const w = x1 - x0;

  for (const aura of auras) {
    const sy = aura.y - camY;
    if (sy < -16 || sy > VIEW_H + 16) continue;
    const pulse = 0.22 + 0.14 * Math.sin(animTime / 18 + aura.y * 0.02);
    const sx = x0 - camX;

    // Outer violet wash
    ctx.fillStyle = `rgba(120,80,200,${pulse * 0.28})`;
    ctx.fillRect(sx, sy - 3, w, 7);
    // Cyan mid band
    ctx.fillStyle = `rgba(100,200,255,${pulse * 0.35})`;
    ctx.fillRect(sx, sy - 1, w, 3);
    // Bright gold-white core line
    ctx.fillStyle = `rgba(230,210,160,${pulse * 0.55})`;
    ctx.fillRect(sx, sy, w, 1);
  }
}
