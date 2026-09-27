/**
 * Pure financial projection engine.
 * state in → project forward N years → new state + event log.
 * No DOM / scene coupling.
 */

import { getDifficulty } from './Difficulty.js';
import { estimateAnnualTax } from './Tax.js';
import { applyAutoEvents, liquidTotal } from './Events.js';
import { HOME_TYPES } from '../config.js';

/** Deep-ish clone for portfolio snapshots. */
export function cloneState(s) {
  return JSON.parse(JSON.stringify(s));
}

/**
 * Compute liquid, illiquid, debts, net worth from a portfolio state.
 */
export function computeWorth(state) {
  const cash = state.cash || 0;
  const savings = state.savings || 0;
  const stocks = state.stocksTotal || 0;
  const liquid = cash + savings + stocks;

  let homeValue = 0;
  let mortgage = 0;
  for (const h of state.homes || []) {
    homeValue += h.value || 0;
    mortgage += h.mortgageOwed || 0;
  }
  const illiquid = homeValue; // equity tracked separately below
  const homeEquity = homeValue - mortgage;
  const debts = mortgage + (state.otherDebt || 0);
  const netWorth = Math.round(liquid + homeEquity - (state.otherDebt || 0));

  return {
    liquid: Math.round(liquid),
    illiquid: Math.round(homeValue),
    homeEquity: Math.round(homeEquity),
    debts: Math.round(debts),
    netWorth,
    cash,
    savings,
    stocks,
  };
}

/**
 * Annual mortgage payment (principal + interest) for a home.
 */
export function annualMortgagePayment(home) {
  const P = home.mortgageOwed || 0;
  const r = (home.rate || 0) / 12;
  const n = (home.remainingTerm || 0) * 12;
  if (P <= 0 || n <= 0) return 0;
  if (r === 0) return P / (home.remainingTerm || 1);
  const monthly = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return monthly * 12;
}

/**
 * Apply one year of growth / costs to a cloned state.
 * @param {object} state
 * @param {string|object} difficultyId
 * @returns {{ state: object, events: string[], tax: object, worth: object }}
 */
export function projectOneYear(state, difficultyId) {
  const difficulty = typeof difficultyId === 'string' ? getDifficulty(difficultyId) : difficultyId;
  const next = cloneState(state);
  const events = [];

  // Age everyone
  next.age = (next.age || 0) + 1;
  next.year = (next.year || 0) + 1;
  for (const kid of next.kids || []) {
    kid.age = (kid.age || 0) + 1;
  }

  // Auto life events (retirement, college early check, etc.)
  events.push(...applyAutoEvents(next, difficulty));

  // Salary growth if employed
  if (next.employed && !next.retired && next.salary > 0) {
    next.salary = Math.round(next.salary * (1 + difficulty.salaryGrowth));
  }

  // Savings interest
  if (next.savings > 0) {
    const rate = next.savingsRate ?? 0.02;
    const interest = Math.round(next.savings * rate);
    next.savings += interest;
    if (interest > 0) events.push(`Savings interest: +$${fmt(interest)}`);
  }

  // Equity returns
  if (next.stocksTotal > 0) {
    const ret = difficulty.equityReturn;
    // mild noise ±2%
    const noise = 1 + (Math.random() * 0.04 - 0.02);
    const gain = Math.round(next.stocksTotal * ret * noise);
    next.stocksTotal = Math.max(0, next.stocksTotal + gain);
    if (next.tickers?.length) {
      const totalBefore = next.stocksTotal - gain;
      if (totalBefore > 0) {
        for (const t of next.tickers) {
          t.amount = Math.round((t.amount || 0) * (next.stocksTotal / totalBefore));
        }
      }
    }
    events.push(`Market return: ${gain >= 0 ? '+' : ''}$${fmt(gain)}`);
  }

  // Home appreciation (inflation-linked + slight real growth)
  const homeApprec = difficulty.inflation + 0.005;
  for (const home of next.homes || []) {
    home.value = Math.round((home.value || 0) * (1 + homeApprec));
  }

  // Mortgage amortization (one year of payments)
  let mortgagePaid = 0;
  for (const home of next.homes || []) {
    if ((home.mortgageOwed || 0) <= 0 || (home.remainingTerm || 0) <= 0) continue;
    const annual = annualMortgagePayment(home);
    const interest = (home.mortgageOwed || 0) * (home.rate || 0);
    const principal = Math.min(home.mortgageOwed, Math.max(0, annual - interest));
    home.mortgageOwed = Math.max(0, home.mortgageOwed - principal);
    home.remainingTerm = Math.max(0, (home.remainingTerm || 0) - 1);
    mortgagePaid += annual;
    if (home.mortgageOwed < 1) {
      home.mortgageOwed = 0;
      home.remainingTerm = 0;
      events.push(`Mortgage paid off: ${home.label || home.type}.`);
    }
  }

  // Taxes
  const tax = estimateAnnualTax(next, difficulty);
  const spending = (next.annualSpending || 0) * difficulty.expensePressure;
  // Spending breakdown may include mortgage/tax that we also compute —
  // use explicit annualSpending as discretionary+fixed household outlay,
  // and add computed mortgage + property tax + income tax on top of "other" if not already baked in.
  const incomeTax = tax.federal + tax.state;
  const propertyTax = tax.property;

  // Cash flow: salary in, spending + taxes + mortgage out
  const inflow = next.retired ? 0 : (next.salary || 0);
  // Prefer player's stated spending; ensure mortgage & taxes are covered
  const stated = next.annualSpending || 0;
  const statedHasMortgage = !!(next.spendingBreakdown?.mortgage);
  const outflow =
    stated * difficulty.expensePressure +
    (statedHasMortgage ? 0 : mortgagePaid) +
    incomeTax +
    propertyTax;

  const net = inflow - outflow;
  if (net >= 0) {
    // Surplus → savings
    next.savings = (next.savings || 0) + Math.round(net);
    events.push(`Year surplus → savings: +$${fmt(net)}`);
  } else {
    // Deficit → drain liquid
    const need = Math.round(-net);
    let left = need;
    const order = ['cash', 'savings', 'stocksTotal'];
    for (const key of order) {
      if (left <= 0) break;
      const have = next[key] || 0;
      const take = Math.min(have, left);
      next[key] = have - take;
      left -= take;
    }
    if (left > 0) {
      next.otherDebt = (next.otherDebt || 0) + left;
      events.push(`Shortfall borrowed: +$${fmt(left)} debt`);
    } else {
      events.push(`Year deficit covered from liquid assets: −$${fmt(need)}`);
    }
  }

  // Inflate discretionary spending baseline for next year
  next.annualSpending = Math.round((next.annualSpending || 0) * (1 + difficulty.inflation));
  if (next.spendingBreakdown) {
    for (const k of Object.keys(next.spendingBreakdown)) {
      next.spendingBreakdown[k] = Math.round(
        (next.spendingBreakdown[k] || 0) * (1 + difficulty.inflation)
      );
    }
  }

  const worth = computeWorth(next);
  return { state: next, events, tax, worth };
}

/**
 * Project from baseline state forward `years` steps.
 * Returns array of yearly snapshots (length = years).
 */
export function projectYears(baseline, years, difficultyId) {
  const difficulty = typeof difficultyId === 'string' ? getDifficulty(difficultyId) : difficultyId;
  let current = cloneState(baseline);
  const snapshots = [];
  for (let i = 0; i < years; i++) {
    const result = projectOneYear(current, difficulty);
    current = result.state;
    snapshots.push(result);
  }
  return snapshots;
}

/**
 * Interpolate projected HUD stats for hallway walking.
 * `progress` 0..1 across the full hallway (startAge → 100).
 * Returns a projected state for the visual year underfoot.
 */
export function projectAtProgress(baseline, progress, difficultyId) {
  const startAge = baseline.age;
  const yearsLeft = Math.max(0, 100 - startAge);
  const yearOffset = Math.min(yearsLeft, Math.floor(progress * yearsLeft));
  if (yearOffset <= 0) {
    return { state: cloneState(baseline), yearOffset: 0, events: [], worth: computeWorth(baseline) };
  }
  const snaps = projectYears(baseline, yearOffset, difficultyId);
  const last = snaps[snaps.length - 1];
  return { state: last.state, yearOffset, events: last.events, worth: last.worth };
}

/** Decision-room mutations */

export function buyHome(state, homeSpec) {
  const next = cloneState(state);
  const down = homeSpec.downPayment || 0;
  const value = homeSpec.value || 0;
  const mortgage = Math.max(0, value - down);
  // Pay down payment from liquid
  let left = down;
  for (const key of ['cash', 'savings', 'stocksTotal']) {
    if (left <= 0) break;
    const take = Math.min(next[key] || 0, left);
    next[key] = (next[key] || 0) - take;
    left -= take;
  }
  next.homes = next.homes || [];
  next.homes.push({
    type: homeSpec.type || 'primary',
    label: homeSpec.label || HOME_TYPES[homeSpec.type || 'primary']?.label || 'Home',
    value,
    mortgageOwed: mortgage,
    rate: homeSpec.rate ?? 0.065,
    remainingTerm: homeSpec.term ?? 30,
    propertyTaxRate: HOME_TYPES[homeSpec.type || 'primary']?.taxRate ?? 0.012,
  });
  return next;
}

export function sellHome(state, index) {
  const next = cloneState(state);
  if (!next.homes?.[index]) return next;
  const home = next.homes[index];
  const equity = (home.value || 0) - (home.mortgageOwed || 0);
  next.cash = (next.cash || 0) + Math.max(0, equity);
  next.homes.splice(index, 1);
  return next;
}

export function sellStock(state, amount) {
  const next = cloneState(state);
  const sell = Math.min(amount, next.stocksTotal || 0);
  next.stocksTotal = (next.stocksTotal || 0) - sell;
  next.cash = (next.cash || 0) + sell;
  if (next.tickers?.length && sell > 0) {
    const old = next.stocksTotal + sell;
    const ratio = old > 0 ? next.stocksTotal / old : 0;
    for (const t of next.tickers) t.amount = Math.round((t.amount || 0) * ratio);
  }
  return next;
}

export function setEmployment(state, mode) {
  // mode: 'leave' | 'start' | 'retire'
  const next = cloneState(state);
  if (mode === 'leave') {
    next.employed = false;
    next.salary = 0;
  } else if (mode === 'retire') {
    next.employed = false;
    next.retired = true;
    next.salary = 0;
  } else if (mode === 'start') {
    next.employed = true;
    next.retired = false;
    if (!next.salary) next.salary = 50000;
  }
  return next;
}

export function addKid(state, kid = {}) {
  const next = cloneState(state);
  next.kids = next.kids || [];
  if (next.kids.length >= 4) return next;
  next.kids.push({ name: kid.name || `Child ${next.kids.length + 1}`, age: kid.age ?? 0 });
  // bump spending a bit
  next.annualSpending = Math.round((next.annualSpending || 0) + 8000);
  return next;
}

export function largePurchase(state, amount) {
  const next = cloneState(state);
  let left = Math.max(0, amount);
  for (const key of ['cash', 'savings', 'stocksTotal']) {
    if (left <= 0) break;
    const take = Math.min(next[key] || 0, left);
    next[key] = (next[key] || 0) - take;
    left -= take;
  }
  if (left > 0) next.otherDebt = (next.otherDebt || 0) + left;
  return next;
}

function fmt(n) {
  return Math.round(n).toLocaleString('en-US');
}

export { liquidTotal };
