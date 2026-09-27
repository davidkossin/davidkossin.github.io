import { VIEW_W, VIEW_H, HOME_TYPES } from '../config.js';
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
  buyStock,
  sellStock,
  setEmployment,
  addKid,
  largePurchase,
  computeWorth,
} from '../finance/Engine.js';
import { getDifficulty } from '../finance/Difficulty.js';
import { commitRoomDecisions } from '../state/GameState.js';
import { autoSave } from '../state/SaveSystem.js';
import { formatMoneyDisplay } from '../render/Dialog.js';

export class RoomScene {
  constructor() {
    this.world = null;
    this.player = null;
    this.hud = new Hud();
    this.prompt = null;
    this.locked = false;
    this.animTime = 0;
  }

  enter(game, spawnNearDoor = false) {
    this.world = buildDecisionRoom();
    const sp = this.world.spawn;
    this.player = new Player(sp.x, spawnNearDoor ? 2 * 16 : sp.y, { speed: 1.5 });
    this.player.bindInput();
    this.prompt = null;
    this.locked = false;
    this.animTime = 0;
    commitRoomDecisions(game, 'begin');
    autoSave(game, 'begin');
  }

  leave() {
    this.player?.unbindInput();
  }

  update(game, dialog) {
    this.animTime += 1;
    if (dialog.active || this.locked) return null;
    this.player.update((x, y, w, h) => isSolid(this.world, x, y, w, h));
    this.prompt = findFacingInteractable(this.player, this.world);
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
    const diff = getDifficulty(p.difficulty || 'standard');

    if (action === 'home') {
      const mode = await dialog.menu(
        'Real estate window',
        [
          { label: 'Buy a home', value: 'buy' },
          { label: 'Sell a home', value: 'sell' },
          { label: 'Never mind', value: null },
        ],
        { title: 'Buy/Sell Home' }
      );
      if (mode === 'buy') {
        if ((p.homes || []).length >= 5) {
          await dialog.show('You already hold 5 properties.', { title: 'Buy/Sell Home' });
          return;
        }
        const type = await dialog.menu(
          'Property type?',
          [
            { label: 'Primary', value: 'primary' },
            { label: 'Secondary', value: 'secondary' },
            { label: 'Investment', value: 'investment' },
          ],
          { title: 'Buy Home' }
        );
        if (type == null) return;
        const value = await dialog.prompt('Purchase price ($)?', {
          title: 'Buy Home',
          defaultValue: '400000',
          type: 'money',
        });
        if (value == null) return;
        const down = await dialog.prompt('Down payment ($)?', {
          title: 'Buy Home',
          defaultValue: String(Math.round(value * 0.2)),
          type: 'money',
        });
        if (down == null) return;
        const ratePct = await dialog.prompt('Mortgage rate (%)?', {
          title: 'Buy Home',
          defaultValue: '6.5',
          type: 'percent',
        });
        if (ratePct == null) return;
        const term = await dialog.prompt('Term (years)?', {
          title: 'Buy Home',
          defaultValue: '30',
          type: 'number',
        });
        if (term == null) return;
        game.portfolio = buyHome(p, {
          type,
          value,
          downPayment: down || 0,
          rate: (ratePct || 0) / 100,
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
              label: `${h.label || h.type} — ${formatMoneyDisplay(h.value)}`,
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
      const mode = await dialog.menu(
        `Portfolio: ${formatMoneyDisplay(p.stocksTotal || 0)}`,
        [
          { label: 'Buy stock', value: 'buy' },
          { label: 'Sell stock', value: 'sell' },
          { label: 'Never mind', value: null },
        ],
        { title: 'Buy/Sell Stock' }
      );
      if (mode === 'buy') {
        const amt = await dialog.prompt('Buy how much ($)?', {
          title: 'Buy Stock',
          defaultValue: '1000',
          type: 'money',
        });
        if (amt == null) return;
        game.portfolio = buyStock(game.portfolio, Math.max(0, amt));
        await dialog.show('Shares purchased. Cost basis updated.', { title: 'Buy Stock' });
      } else if (mode === 'sell') {
        await this.handleSellStock(game, dialog, diff);
      }
    } else if (action === 'job') {
      const mode = await dialog.menu(
        'Career window',
        [
          { label: 'Leave job (salary → $0)', value: 'leave' },
          { label: 'Start / resume job', value: 'start' },
          { label: 'Retire', value: 'retire' },
          { label: 'Never mind', value: null },
        ],
        { title: 'Job / Retire' }
      );
      if (!mode) return;
      if (mode === 'start') {
        const sal = await dialog.prompt('New annual household gross salary ($)?', {
          title: 'Start Job',
          defaultValue: String(p.salary || 50000),
          type: 'money',
        });
        if (sal == null) return;
        game.portfolio = setEmployment(game.portfolio, 'start');
        game.portfolio.salary = Math.max(0, sal);
        game.portfolio.peakSalary = Math.max(game.portfolio.peakSalary || 0, sal);
      } else {
        game.portfolio = setEmployment(game.portfolio, mode);
      }
      await dialog.show('Employment updated.', { title: 'Job / Retire' });
    } else if (action === 'kid') {
      if ((p.kids || []).length >= 4) {
        await dialog.show('Four kids is the max for this ledger.', { title: 'Have A Kid' });
        return;
      }
      const name = await dialog.prompt("Child's name?", {
        title: 'Have A Kid',
        defaultValue: `Child ${(p.kids || []).length + 1}`,
      });
      if (name == null) return;
      game.portfolio = addKid(game.portfolio, { name: name || 'Child', age: 0 });
      await dialog.show(
        `${name} joins the timeline at age 0. Annual costs follow the age schedule.`,
        { title: 'Have A Kid' }
      );
    } else if (action === 'purchase') {
      const amt = await dialog.prompt('Large purchase amount ($)?', {
        title: 'Large Purchase',
        defaultValue: '5000',
        type: 'money',
      });
      if (amt == null) return;
      game.portfolio = largePurchase(game.portfolio, Math.max(0, amt));
      await dialog.show('Purchase recorded against liquid assets.', { title: 'Large Purchase' });
    }
  }

  async handleSellStock(game, dialog, diff) {
    const p = game.portfolio;
    const held = p.stocksTotal || 0;
    if (held <= 0) {
      await dialog.show('No stock to sell.', { title: 'Sell Stock' });
      return;
    }
    const mode = await dialog.menu(
      `Held: ${formatMoneyDisplay(held)}`,
      [
        { label: 'Sell $ amount', value: 'amount' },
        { label: 'Sell % of portfolio', value: 'percent' },
        { label: 'Cancel', value: null },
      ],
      { title: 'Sell Stock' }
    );
    if (!mode) return;

    let proceeds = 0;
    if (mode === 'amount') {
      const amt = await dialog.prompt('Sale amount ($)?', {
        title: 'Sell Stock',
        defaultValue: String(Math.min(held, 1000)),
        type: 'money',
      });
      if (amt == null) return;
      proceeds = Math.min(held, Math.max(0, amt));
    } else {
      const pct = await dialog.prompt('% of portfolio to sell?', {
        title: 'Sell Stock',
        defaultValue: '10',
        type: 'percent',
      });
      if (pct == null) return;
      proceeds = Math.round(held * (Math.max(0, Math.min(100, pct)) / 100));
    }

    const gains = await dialog.prompt('Realized gains on this sale ($)?', {
      title: 'Capital Gains',
      defaultValue: '0',
      type: 'money',
    });
    if (gains == null) return;

    const yearsHeld = await dialog.prompt('Years held?', {
      title: 'Capital Gains',
      defaultValue: '1',
      type: 'number',
    });
    if (yearsHeld == null) return;

    const result = sellStock(
      game.portfolio,
      { proceeds, gains: Math.max(0, gains), yearsHeld: Math.max(0, yearsHeld) },
      diff
    );
    game.portfolio = result.state;
    await dialog.show(
      `Sold ${formatMoneyDisplay(result.proceeds)}.\n` +
        `CGT ${result.tax.longTerm ? 'LT' : 'ST'}: ${formatMoneyDisplay(result.tax.total)}\n` +
        `(${result.tax.rateNote})\n` +
        `Net to bank: ${formatMoneyDisplay(result.netCash)}`,
      { title: 'Sell Stock' }
    );
  }

  render(ctx, game) {
    const camX = Math.max(0, Math.min(this.world.width - VIEW_W, this.player.x + 6 - VIEW_W / 2));
    const camY = Math.max(0, Math.min(this.world.height - VIEW_H, this.player.y - VIEW_H / 2));

    ctx.save();
    drawWorld(ctx, this.world, camX, camY, this.animTime);
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
