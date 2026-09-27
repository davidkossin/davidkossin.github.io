import { VIEW_W, VIEW_H, MAX_AGE } from '../config.js';
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
    /** @type {Array<{state:object, worth:object}>} */
    this.snapshots = [];
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
      { state: cloneState(this.baseline), worth: computeWorth(this.baseline) },
    ];
    if (yearsToProject > 0) {
      const snaps = projectYears(
        this.baseline,
        yearsToProject,
        game.portfolio.difficulty || this.baseline.difficulty,
        { deterministic: true }
      );
      for (const s of snaps) {
        this.snapshots.push({ state: s.state, worth: s.worth });
      }
    }
    this.visual = this.snapshots[0];
    autoSave(game, 'end');
  }

  leave() {
    this.player?.unbindInput();
  }

  update(game) {
    this.animTime += 1;
    this.player.update((x, y, w, h) => isSolid(this.world, x, y, w, h));
    this.prompt = findFacingInteractable(this.player, this.world, 22);

    const progress = this.world.progressAtY(this.player.y);
    const maxIdx = this.snapshots.length - 1;
    const idx = Math.max(0, Math.min(maxIdx, Math.floor(progress * maxIdx)));
    this.visual = this.snapshots[idx];
  }

  stateAtDoor(yearIndex) {
    // yearIndex is 1-based years from leave (see World.buildHallway)
    const idx = Math.max(0, Math.min(this.snapshots.length - 1, yearIndex));
    return this.snapshots[idx];
  }

  async tryInteract(game, dialog) {
    const obj = findFacingInteractable(this.player, this.world, 22);
    if (!obj) return null;

    if (obj.kind === 'year-door') {
      const snap = this.stateAtDoor(obj.yearIndex);
      const state = cloneState(snap.state);
      state.year = obj.year;
      state.age = obj.age;

      const ok = await dialog.confirm(
        `Enter Decision Room for ${obj.year} (age ${obj.age})?\nBranches a new timeline from projected finances.`,
        { title: 'Year Door', yes: 'Enter', no: 'Stay' }
      );
      if (!ok) return null;
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
        return null;
      }
      this.leave();
      return { goto: 'ending' };
    }

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

    drawWorld(ctx, this.world, camX, camY, this.animTime);
    ctx.save();
    ctx.translate(-camX, -camY);
    const vis = this.visual?.state || game.portfolio;
    this.player.draw(ctx, vis.hairColor, vis.hairLength, vis.age);
    ctx.restore();

    const portfolio = this.visual?.state || game.portfolio;
    const worth = this.visual?.worth || computeWorth(portfolio);
    this.hud.draw(ctx, portfolio, worth);

    if (this.prompt) {
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = '#f0e8c8';
      ctx.textAlign = 'center';
      ctx.fillText(`[E] ${this.prompt.label}`, VIEW_W / 2, VIEW_H - 12);
      ctx.textAlign = 'left';
    }
  }
}
