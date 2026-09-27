/**
 * Pure financial projection engine.
 * state in → project forward N years → new state + event log.
 * No DOM / scene coupling.
 */

import { getDifficulty } from './Difficulty.js';
import { estimateAnnualTax, estimateCapitalGainsTax } from './Tax.js';
import { applyAutoEvents, liquidTotal } from './Events.js';
import { resolveRng } from './rng.js';
import { HOME_TYPES, CHILD_COST_BANDS } from '../config.js';

/** Deep-ish clone for portfolio snapshots. */
export function cloneState(s) {
  return JSON.parse(JSON.stringify(s));
}

/**
 * USDA-style annual cost of raising one child (pre-college).
 * Ages 18–22 use college cost in Events only — not double-counted here.
 * Scaled by difficulty.expensePressure and childCostInflator on state.
 */
export function annualChildCost(age, difficulty, inflator = 1) {
  let base = 0;
  for (const band of CHILD_COST_BANDS) {
    if (age <= band.maxAge) {
      base = band.annual;
      break;
    }
  }
  return Math.round(base * (difficulty.expensePressure || 1) * (inflator || 1));
}

/**
 * Compute bank (cash), portfolio (net worth), and legacy liquid/illiquid.
 * HUD: Bank = cash on hand only; Portfolio = net worth.
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
  const homeEquity = homeValue - mortgage;
  const debts = mortgage + (state.otherDebt || 0);
  const netWorth = Math.round(liquid + homeEquity - (state.otherDebt || 0));

  return {
    bank: Math.round(cash),
    portfolio: netWorth,
    liquid: Math.round(liquid),
    illiquid: Math.round(homeValue),
    homeEquity: Math.round(homeEquity),
    debts: Math.round(debts),
    netWorth,
    cash,
    savings,
    stocks,
    stocksCostBasis: Math.round(state.stocksCostBasis || 0),
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
 * @param {object} [opts] - { deterministic, seed, rng }
 * @returns {{ state: object, events: string[], tax: object, worth: object }}
 */
export function projectOneYear(state, difficultyId, opts = {}) {
  const difficulty = typeof difficultyId === 'string' ? getDifficulty(difficultyId) : difficultyId;
  const next = cloneState(state);
  const events = [];
  const rng = resolveRng(opts);

  // Age everyone
  next.age = (next.age || 0) + 1;
  next.year = (next.year || 0) + 1;
  for (const kid of next.kids || []) {
    kid.age = (kid.age || 0) + 1;
  }

  // Inflate child-cost schedule once per year
  next.childCostInflator = (next.childCostInflator || 1) * (1 + (difficulty.inflation || 0));

  // Auto life events (retirement, college, shocks, SS stub)
  events.push(...applyAutoEvents(next, difficulty, opts));

  // Salary growth if employed
  if (next.employed && !next.retired && next.salary > 0) {
    next.salary = Math.round(next.salary * (1 + difficulty.salaryGrowth));
    next.peakSalary = Math.max(next.peakSalary || 0, next.salary);
  }

  // Savings interest
  if (next.savings > 0) {
    const rate = next.savingsRate ?? 0.02;
    const interest = Math.round(next.savings * rate);
    next.savings += interest;
    if (interest > 0) events.push(`Savings interest: +$${fmt(interest)}`);
  }

  // Equity returns — deterministic (no noise) when projecting hallway HUD
  if (next.stocksTotal > 0) {
    const ret = difficulty.equityReturn;
    const noise = opts.deterministic ? 1 : 1 + (rng() * 0.04 - 0.02);
    const gain = Math.round(next.stocksTotal * ret * noise);
    // Cost basis unchanged on mark-to-market (unrealized)
    next.stocksTotal = Math.max(0, next.stocksTotal + gain);
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

  // Annual USDA-style child costs (every year, age-banded)
  let childCosts = 0;
  for (const kid of next.kids || []) {
    const c = annualChildCost(kid.age, difficulty, next.childCostInflator);
    if (c > 0) {
      childCosts += c;
      events.push(`Child cost (${kid.name || 'child'}, age ${kid.age}): −$${fmt(c)}`);
    }
  }

  // Taxes
  const tax = estimateAnnualTax(next, difficulty);
  const incomeTax = tax.federal + tax.state;
  const propertyTax = tax.property;

  // Cash flow: salary + SS in; spending + taxes + mortgage + child costs out
  const inflow =
    (next.retired ? 0 : next.salary || 0) + (next.socialSecurity || 0);
  const stated = next.annualSpending || 0;
  const statedHasMortgage = !!(next.spendingBreakdown?.mortgage);
  const outflow =
    stated * difficulty.expensePressure +
    (statedHasMortgage ? 0 : mortgagePaid) +
    incomeTax +
    propertyTax +
    childCosts;

  const net = inflow - outflow;
  if (net >= 0) {
    next.savings = (next.savings || 0) + Math.round(net);
    events.push(`Year surplus → savings: +$${fmt(net)}`);
  } else {
    const need = Math.round(-net);
    let left = need;
    const order = ['cash', 'savings', 'stocksTotal'];
    for (const key of order) {
      if (left <= 0) break;
      const have = next[key] || 0;
      const take = Math.min(have, left);
      if (key === 'stocksTotal' && take > 0 && have > 0) {
        const ratio = take / have;
        next.stocksCostBasis = Math.max(
          0,
          Math.round((next.stocksCostBasis || 0) * (1 - ratio))
        );
      }
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
 * Hallway HUD should pass { deterministic: true } so numbers don't jitter.
 */
export function projectYears(baseline, years, difficultyId, opts = {}) {
  const difficulty = typeof difficultyId === 'string' ? getDifficulty(difficultyId) : difficultyId;
  let current = cloneState(baseline);
  const snapshots = [];
  for (let i = 0; i < years; i++) {
    const result = projectOneYear(current, difficulty, opts);
    current = result.state;
    snapshots.push(result);
  }
  return snapshots;
}

/**
 * Interpolate projected HUD stats for hallway walking.
 */
export function projectAtProgress(baseline, progress, difficultyId, opts = {}) {
  const startAge = baseline.age;
  const yearsLeft = Math.max(0, 100 - startAge);
  const yearOffset = Math.min(yearsLeft, Math.floor(progress * yearsLeft));
  if (yearOffset <= 0) {
    return { state: cloneState(baseline), yearOffset: 0, events: [], worth: computeWorth(baseline) };
  }
  const snaps = projectYears(baseline, yearOffset, difficultyId, {
    deterministic: true,
    ...opts,
  });
  const last = snaps[snaps.length - 1];
  return { state: last.state, yearOffset, events: last.events, worth: last.worth };
}

/** Decision-room mutations */

export function buyHome(state, homeSpec) {
  const next = cloneState(state);
  const down = homeSpec.downPayment || 0;
  const value = homeSpec.value || 0;
  const mortgage = Math.max(0, value - down);
  let left = down;
  for (const key of ['cash', 'savings', 'stocksTotal']) {
    if (left <= 0) break;
    const take = Math.min(next[key] || 0, left);
    if (key === 'stocksTotal' && take > 0 && (next[key] || 0) > 0) {
      const ratio = take / next[key];
      next.stocksCostBasis = Math.max(
        0,
        Math.round((next.stocksCostBasis || 0) * (1 - ratio))
      );
    }
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

/**
 * Buy stock: pay from cash/savings, increase total + cost basis.
 */
export function buyStock(state, amount) {
  const next = cloneState(state);
  let left = Math.max(0, amount);
  const paid = Math.min(left, (next.cash || 0) + (next.savings || 0));
  let remain = paid;
  const fromCash = Math.min(next.cash || 0, remain);
  next.cash = (next.cash || 0) - fromCash;
  remain -= fromCash;
  if (remain > 0) {
    next.savings = (next.savings || 0) - remain;
  }
  next.stocksTotal = (next.stocksTotal || 0) + paid;
  next.stocksCostBasis = (next.stocksCostBasis || 0) + paid;
  return next;
}

/**
 * Sell stock with capital gains tax.
 * @param {object} state
 * @param {object} opts
 * @param {number} opts.proceeds - gross sale amount ($)
 * @param {number} [opts.gains] - realized gains $ (player-entered; used for tax)
 * @param {number} [opts.yearsHeld]
 * @param {object} [difficulty]
 * @returns {{ state: object, tax: object, netCash: number, proceeds: number }}
 */
export function sellStock(state, opts = {}, difficulty = null) {
  const next = cloneState(state);
  const held = next.stocksTotal || 0;
  let proceeds = Math.max(0, Number(opts.proceeds) || 0);
  if (opts.percent != null) {
    proceeds = Math.round(held * (Number(opts.percent) / 100));
  }
  proceeds = Math.min(proceeds, held);

  const gains = Math.max(0, Number(opts.gains) || 0);
  const yearsHeld = Number(opts.yearsHeld) || 0;
  const diff = difficulty || getDifficulty(next.difficulty || 'standard');
  const tax = estimateCapitalGainsTax({
    gains,
    yearsHeld,
    state: next,
    difficulty: diff,
  });

  // Reduce cost basis proportionally to proceeds / holdings
  if (held > 0 && proceeds > 0) {
    const ratio = proceeds / held;
    next.stocksCostBasis = Math.max(
      0,
      Math.round((next.stocksCostBasis || 0) * (1 - ratio))
    );
  }
  next.stocksTotal = held - proceeds;
  const netCash = Math.max(0, proceeds - tax.total);
  next.cash = (next.cash || 0) + netCash;

  return { state: next, tax, netCash, proceeds };
}

/** @deprecated use sellStock with opts — kept for simple cash sells without tax UI */
export function sellStockSimple(state, amount) {
  const result = sellStock(state, { proceeds: amount, gains: 0, yearsHeld: 1 });
  return result.state;
}

export function setEmployment(state, mode) {
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

/**
 * Have a kid — name only; age starts at 0.
 * Annual costs come from the USDA schedule in projectOneYear (no flat +8000).
 */
export function addKid(state, kid = {}) {
  const next = cloneState(state);
  next.kids = next.kids || [];
  if (next.kids.length >= 4) return next;
  next.kids.push({
    name: kid.name || `Child ${next.kids.length + 1}`,
    age: kid.age ?? 0,
  });
  return next;
}

export function largePurchase(state, amount) {
  const next = cloneState(state);
  let left = Math.max(0, amount);
  for (const key of ['cash', 'savings', 'stocksTotal']) {
    if (left <= 0) break;
    const have = next[key] || 0;
    const take = Math.min(have, left);
    if (key === 'stocksTotal' && take > 0 && have > 0) {
      const ratio = take / have;
      next.stocksCostBasis = Math.max(
        0,
        Math.round((next.stocksCostBasis || 0) * (1 - ratio))
      );
    }
    next[key] = have - take;
    left -= take;
  }
  if (left > 0) next.otherDebt = (next.otherDebt || 0) + left;
  return next;
}

function fmt(n) {
  return Math.round(n).toLocaleString('en-US');
}

export { liquidTotal, estimateCapitalGainsTax };
