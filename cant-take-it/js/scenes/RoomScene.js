import { VIEW_W, VIEW_H, KEYS } from '../config.js';
import { Player } from '../render/Player.js';
import { Hud } from '../render/Hud.js';
import {
  buildDecisionRoom,
  drawWorld,
  isSolid,
  findFacingInteractable,
} from '../render/World.js';
import {
  buyHome,
  sellHome,
  sellStock,
  setEmployment,
  addKid,
  largePurchase,
  computeWorth,
} from '../finance/Engine.js';
import { commitRoomDecisions } from '../state/GameState.js';
import { autoSave } from '../state/SaveSystem.js';
import { HOME_TYPES } from '../config.js';

export class RoomScene {
  constructor() {
    this.world = null;
    this.player = null;
    this.hud = new Hud();
    this.prompt = null;
    this.locked = false;
  }

  enter(game, spawnNearDoor = false) {
    this.world = buildDecisionRoom();
    const sp = this.world.spawn;
    this.player = new Player(sp.x, spawnNearDoor ? 2 * 16 : sp.y);
    this.player.bindInput();
    this.prompt = null;
    this.locked = false;
    // Auto-save begin of year on entering room
    commitRoomDecisions(game, 'begin');
    autoSave(game, 'begin');
  }

  leave() {
    this.player?.unbindInput();
  }

  update(game, dialog) {
    if (dialog.active || this.locked) return null;

    this.player.update((x, y, w, h) => isSolid(this.world, x, y, w, h));

    const obj = findFacingInteractable(this.player, this.world);
    this.prompt = obj;

    // Interaction is handled via key in main → tryInteract
    return null;
  }

  async tryInteract(game, dialog) {
    if (dialog.active || this.locked) return null;
    const obj = findFacingInteractable(this.player, this.world);
    if (!obj) return null;

    if (obj.kind === 'door') {
      const ok = await dialog.confirm(
        `Are you ready to leave ${game.portfolio.year}?`,
        { title: 'Hallway of Time', yes: 'Enter hallway', no: 'Stay' }
      );
      if (ok) {
        commitRoomDecisions(game, 'end');
        autoSave(game, 'end');
        this.leave();
        return { goto: 'hallway' };
      }
      return null;
    }

    if (obj.kind === 'teller') {
      await this.handleTeller(game, dialog, obj.action);
      game.lastWorth = computeWorth(game.portfolio);
      return null;
    }
    return null;
  }

  async handleTeller(game, dialog, action) {
    const p = game.portfolio;
    if (action === 'home') {
      const mode = await dialog.menu('Real estate desk', [
        { label: 'Buy a home', value: 'buy' },
        { label: 'Sell a home', value: 'sell' },
        { label: 'Never mind', value: null },
      ], { title: 'Buy / Sell Home' });
      if (mode === 'buy') {
        if ((p.homes || []).length >= 5) {
          await dialog.show('You already hold 5 properties.', { title: 'Buy / Sell Home' });
          return;
        }
        const type = await dialog.menu('Property type?', [
          { label: 'Primary', value: 'primary' },
          { label: 'Secondary', value: 'secondary' },
          { label: 'Investment', value: 'investment' },
        ], { title: 'Buy Home' });
        const value = await dialog.prompt('Purchase price ($)?', {
          title: 'Buy Home',
          defaultValue: '400000',
          type: 'number',
        });
        if (value == null) return;
        const down = await dialog.prompt('Down payment ($)?', {
          title: 'Buy Home',
          defaultValue: String(Math.round(value * 0.2)),
          type: 'number',
        });
        if (down == null) return;
        const rate = await dialog.prompt('Mortgage rate?', {
          title: 'Buy Home',
          defaultValue: '0.065',
          type: 'number',
        });
        const term = await dialog.prompt('Term (years)?', {
          title: 'Buy Home',
          defaultValue: '30',
          type: 'number',
        });
        game.portfolio = buyHome(p, {
          type,
          value,
          downPayment: down || 0,
          rate: rate ?? 0.065,
          term: term ?? 30,
          label: HOME_TYPES[type]?.label,
        });
        await dialog.show('Keys are yours. Mortgage recorded.', { title: 'Buy Home' });
      } else if (mode === 'sell') {
        if (!p.homes?.length) {
          await dialog.show('No homes to sell.', { title: 'Sell Home' });
          return;
        }
        const idx = await dialog.menu(
          'Sell which home?',
          [
            ...p.homes.map((h, i) => ({
              label: `${h.label || h.type} — $${Math.round(h.value).toLocaleString()}`,
              value: i,
            })),
            { label: 'Cancel', value: null },
          ],
          { title: 'Sell Home' }
        );
        if (idx == null) return;
        game.portfolio = sellHome(game.portfolio, idx);
        await dialog.show('Sold. Equity moved to cash.', { title: 'Sell Home' });
      }
    } else if (action === 'stock') {
      const amt = await dialog.prompt(
        `Sell how much stock? (held: $${Math.round(p.stocksTotal || 0).toLocaleString()})`,
        { title: 'Sell Stock', defaultValue: '1000', type: 'number' }
      );
      if (amt == null) return;
      game.portfolio = sellStock(game.portfolio, Math.max(0, amt));
      await dialog.show('Shares sold to cash.', { title: 'Sell Stock' });
    } else if (action === 'job') {
      const mode = await dialog.menu('Career desk', [
        { label: 'Leave job (salary → $0)', value: 'leave' },
        { label: 'Start / resume job', value: 'start' },
        { label: 'Retire', value: 'retire' },
        { label: 'Never mind', value: null },
      ], { title: 'Job / Retire' });
      if (!mode) return;
      if (mode === 'start') {
        const sal = await dialog.prompt('New annual salary ($)?', {
          title: 'Start Job',
          defaultValue: String(p.salary || 50000),
          type: 'number',
        });
        game.portfolio = setEmployment(game.portfolio, 'start');
        if (sal != null) game.portfolio.salary = Math.max(0, sal);
      } else {
        game.portfolio = setEmployment(game.portfolio, mode);
      }
      await dialog.show('Employment updated.', { title: 'Job / Retire' });
    } else if (action === 'kid') {
      if ((p.kids || []).length >= 4) {
        await dialog.show('Four kids is the max for this ledger.', { title: 'Family' });
        return;
      }
      const ok = await dialog.confirm('Add a child? Spending will rise.', { title: 'Have a Kid' });
      if (!ok) return;
      const age = await dialog.prompt('Child age?', {
        title: 'Have a Kid',
        defaultValue: '0',
        type: 'number',
      });
      game.portfolio = addKid(game.portfolio, { age: age ?? 0 });
      await dialog.show('A new dependent joins the timeline.', { title: 'Have a Kid' });
    } else if (action === 'purchase') {
      const amt = await dialog.prompt('Large purchase amount ($)?', {
        title: 'Large Purchase',
        defaultValue: '5000',
        type: 'number',
      });
      if (amt == null) return;
      game.portfolio = largePurchase(game.portfolio, Math.max(0, amt));
      await dialog.show('Purchase recorded against liquid assets.', { title: 'Large Purchase' });
    }
  }


  /**
   * Draw with camera applied via ctx transform from main, OR we handle here.
   */
  render(ctx, game) {
    const camX = Math.max(0, Math.min(this.world.width - VIEW_W, this.player.x + 6 - VIEW_W / 2));
    const camY = Math.max(0, Math.min(this.world.height - VIEW_H, this.player.y - VIEW_H / 2));

    ctx.save();
    drawWorld(ctx, this.world, camX, camY);
    ctx.translate(-camX, -camY);
    this.player.draw(
      ctx,
      game.portfolio.hairColor,
      game.portfolio.hairLength,
      game.portfolio.age
    );
    ctx.restore();

    this.hud.draw(ctx, game.portfolio);

    if (this.prompt && !this.locked) {
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = '#f0e8c8';
      ctx.textAlign = 'center';
      ctx.fillText(`[E] ${this.prompt.label}`, VIEW_W / 2, VIEW_H - 12);
      ctx.textAlign = 'left';
    }
  }
}
