/**
 * Contextual LTTP-styled setup questionnaires.
 */

import { CURRENT_YEAR, HOME_TYPES } from '../config.js';
import { createDefaultSetup, createGameFromSetup } from '../state/GameState.js';
import { listDifficulties } from '../finance/Difficulty.js';
import { makeTile } from '../render/Assets.js';
import { VIEW_W, VIEW_H, PALETTE } from '../config.js';

export class SetupScene {
  constructor() {
    this.step = 0;
  }

  draw(ctx) {
    const floor = makeTile('wood');
    for (let y = 0; y < VIEW_H; y += 16) {
      for (let x = 0; x < VIEW_W; x += 16) ctx.drawImage(floor, x, y);
    }
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.fillStyle = PALETTE.gold;
    ctx.textAlign = 'center';
    ctx.fillText('Character Setup', VIEW_W / 2, 28);
    ctx.textAlign = 'left';
  }

  /**
   * Run full setup via dialog; returns game state.
   */
  async run(dialog) {
    const s = createDefaultSetup();

    s.playerName =
      (await dialog.prompt('What is your name?', {
        title: 'Identity',
        defaultValue: s.playerName,
      })) || s.playerName;

    const yearIn = await dialog.prompt('Starting calendar year?', {
      title: 'When',
      defaultValue: String(CURRENT_YEAR),
      type: 'number',
    });
    if (yearIn != null) s.year = Math.round(yearIn);

    const ageIn = await dialog.prompt('Your age?', {
      title: 'When',
      defaultValue: String(s.age),
      type: 'number',
    });
    if (ageIn != null) s.age = Math.max(18, Math.min(99, Math.round(ageIn)));

    s.hairColor = await dialog.menu('Hair color?', [
      { label: 'Dark', value: 'dark' },
      { label: 'Blonde', value: 'blonde' },
      { label: 'Red', value: 'red' },
    ], { title: 'Appearance' });

    s.hairLength = await dialog.menu('Hair length?', [
      { label: 'Short', value: 'short' },
      { label: 'Long', value: 'long' },
    ], { title: 'Appearance' });

    const cash = await dialog.prompt('Cash on hand ($)?', {
      title: 'Finances',
      defaultValue: String(s.cash),
      type: 'number',
    });
    if (cash != null) s.cash = Math.max(0, cash);

    const sal = await dialog.prompt('Annual gross salary ($)?', {
      title: 'Finances',
      defaultValue: String(s.salary),
      type: 'number',
    });
    if (sal != null) s.salary = Math.max(0, sal);
    s.employed = s.salary > 0;

    const sav = await dialog.prompt('Savings balance ($)?', {
      title: 'Finances',
      defaultValue: String(s.savings),
      type: 'number',
    });
    if (sav != null) s.savings = Math.max(0, sav);

    const rate = await dialog.prompt('Savings interest rate (e.g. 0.02)?', {
      title: 'Finances',
      defaultValue: String(s.savingsRate),
      type: 'number',
    });
    if (rate != null) s.savingsRate = Math.max(0, Math.min(0.2, rate));

    const stock = await dialog.prompt('Stock portfolio total ($)?', {
      title: 'Investments',
      defaultValue: String(s.stocksTotal),
      type: 'number',
    });
    if (stock != null) s.stocksTotal = Math.max(0, stock);

    const addTicker = await dialog.confirm('Add a sample ticker entry? (amounts already in total)', {
      title: 'Investments',
    });
    if (addTicker) {
      const sym =
        (await dialog.prompt('Ticker symbol?', { title: 'Investments', defaultValue: 'VTI' })) ||
        'VTI';
      const amt = await dialog.prompt('Amount in total ($)?', {
        title: 'Investments',
        defaultValue: String(Math.min(s.stocksTotal, 5000)),
        type: 'number',
      });
      s.tickers = [{ symbol: sym, amount: Math.max(0, amt || 0) }];
    }

    const homeCount = await dialog.menu('How many homes (0–5)?', [
      { label: '0', value: 0 },
      { label: '1', value: 1 },
      { label: '2', value: 2 },
      { label: '3', value: 3 },
      { label: '4', value: 4 },
      { label: '5', value: 5 },
    ], { title: 'Homes' });

    s.homes = [];
    for (let i = 0; i < (homeCount || 0); i++) {
      const type = await dialog.menu(`Home ${i + 1} type?`, [
        { label: 'Primary', value: 'primary' },
        { label: 'Secondary', value: 'secondary' },
        { label: 'Investment', value: 'investment' },
      ], { title: 'Homes' });
      const value = await dialog.prompt('Approx market value ($)?', {
        title: 'Homes',
        defaultValue: '350000',
        type: 'number',
      });
      const owed = await dialog.prompt('Mortgage owed ($)?', {
        title: 'Homes',
        defaultValue: '280000',
        type: 'number',
      });
      const mrate = await dialog.prompt('Mortgage rate (e.g. 0.065)?', {
        title: 'Homes',
        defaultValue: '0.065',
        type: 'number',
      });
      const term = await dialog.prompt('Remaining term (years)?', {
        title: 'Homes',
        defaultValue: '28',
        type: 'number',
      });
      s.homes.push({
        type,
        label: HOME_TYPES[type]?.label || 'Home',
        value: Math.max(0, value || 0),
        mortgageOwed: Math.max(0, owed || 0),
        rate: Math.max(0, mrate || 0.065),
        remainingTerm: Math.max(0, Math.round(term || 30)),
        propertyTaxRate: HOME_TYPES[type]?.taxRate ?? 0.012,
      });
    }

    s.married = await dialog.confirm('Married?', { title: 'Family', yes: 'Yes', no: 'No' });

    const kidCount = await dialog.menu('How many kids (0–4)?', [
      { label: '0', value: 0 },
      { label: '1', value: 1 },
      { label: '2', value: 2 },
      { label: '3', value: 3 },
      { label: '4', value: 4 },
    ], { title: 'Family' });
    s.kids = [];
    for (let i = 0; i < (kidCount || 0); i++) {
      const age = await dialog.prompt(`Age of child ${i + 1}?`, {
        title: 'Family',
        defaultValue: String(5 + i * 3),
        type: 'number',
      });
      s.kids.push({ name: `Child ${i + 1}`, age: Math.max(0, Math.round(age || 0)) });
    }

    const spend = await dialog.prompt('Annual household spending ($)?', {
      title: 'Spending',
      defaultValue: String(s.annualSpending),
      type: 'number',
    });
    if (spend != null) s.annualSpending = Math.max(0, spend);
    s.spendingBreakdown = { other: s.annualSpending };

    const zip = await dialog.prompt('Primary ZIP (for tax estimate)?', {
      title: 'Taxes',
      defaultValue: s.zip,
    });
    if (zip != null) s.zip = String(zip).replace(/\D/g, '').slice(0, 5) || '85001';

    const diffs = listDifficulties();
    s.difficulty = await dialog.menu('Difficulty?', diffs.map((d) => ({
      label: d.label,
      value: d.id,
    })), { title: 'Challenge' });

    await dialog.show(
      `Welcome, ${s.playerName}. Year ${s.year}, age ${s.age}. Your Decision Room awaits.`,
      { title: 'Begin' }
    );

    return createGameFromSetup(s);
  }
}
