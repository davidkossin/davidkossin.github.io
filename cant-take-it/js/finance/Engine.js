/**
 * Pure financial projection engine.
 * state in → project forward N years → new state + event log.
 * No DOM / scene coupling.
 */

import { getDifficulty } from './Difficulty.js';
import {
  estimateAnnualTax,
  estimateCapitalGainsTax,
  employee401kDeferral,
  employer401kMatch,
  estimateTaxOnExtraIncome,
} from './Tax.js';
import { applyAutoEvents, liquidTotal } from './Events.js';
import { resolveRng } from './rng.js';
import {
  HOME_TYPES,
  CHILD_COST_BANDS,
  NATIONAL_AVG_COLLEGE_COST,
  COLLEGE_AGE_MIN,
  COLLEGE_AGE_MAX,
  HELOC_CLTV,
  SB_LTV,
  HELOC_DEFAULT_RATE,
  SECURITIES_LOAN_DEFAULT_RATE,
} from '../config.js';
import { log as debugLog, isEnabled as debugOn } from '../debug/Logger.js';

/** Deep-ish clone for portfolio snapshots. */
export function cloneState(s) {
  return JSON.parse(JSON.stringify(s));
}

/**
 * USDA-style annual cost of raising one child (pre-college).
 * Ages 18–21 use NATIONAL_AVG_COLLEGE_COST tuition in projectOneYear — not double-counted here.
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
 * Compute Cash (`cash`), portfolio (net worth), and legacy liquid/illiquid.
 * HUD: Cash = cash on hand only; Portfolio = net worth.
 */
export function computeWorth(state) {
  const cash = state.cash || 0;
  const savings = state.savings || 0;
  const stocks = state.stocksTotal || 0;
  const k401 = state.k401Balance || 0;
  // 401(k) is illiquid for Decision Room spending (not Cash) but counts in Portfolio
  const liquid = cash + savings + stocks;

  let homeValue = 0;
  let mortgage = 0;
  for (const h of state.homes || []) {
    homeValue += h.value || 0;
    mortgage += h.mortgageOwed || 0;
  }
  const homeEquity = homeValue - mortgage;
  let otherLoansOwed = 0;
  for (const loan of state.otherLoans || []) {
    otherLoansOwed += loan.principal || 0;
  }
  const unsecured = (state.otherDebt || 0) + otherLoansOwed;
  const debts = mortgage + unsecured;
  const netWorth = Math.round(liquid + k401 + homeEquity - unsecured);

  return {
    bank: Math.round(cash),
    portfolio: netWorth,
    liquid: Math.round(liquid),
    illiquid: Math.round(homeValue + k401),
    homeEquity: Math.round(homeEquity),
    debts: Math.round(debts),
    netWorth,
    cash,
    savings,
    stocks,
    k401Balance: Math.round(k401),
    stocksCostBasis: Math.round(state.stocksCostBasis || 0),
  };
}

/**
 * Annual P&I payment for an amortizing loan (mortgage or other).
 * @param {number} principal
 * @param {number} annualRate decimal (e.g. 0.069)
 * @param {number} remainingTermYears
 */
export function annualAmortizingPayment(principal, annualRate, remainingTermYears) {
  const P = principal || 0;
  const n = (remainingTermYears || 0) * 12;
  if (P <= 0 || n <= 0) return 0;
  const r = (annualRate || 0) / 12;
  if (r === 0) return P / (remainingTermYears || 1);
  const monthly = (P * r * Math.pow(1 + r, n)) / (Math.pow(1 + r, n) - 1);
  return monthly * 12;
}

/**
 * Annual mortgage payment (principal + interest) for a home.
 */
export function annualMortgagePayment(home) {
  return annualAmortizingPayment(home.mortgageOwed || 0, home.rate || 0, home.remainingTerm || 0);
}

/** Annual payment for a financed other-loan entry. */
export function annualLoanPayment(loan) {
  return annualAmortizingPayment(loan.principal || 0, loan.rate || 0, loan.remainingTerm || 0);
}

/**
 * Apply one year of growth / costs to a cloned state.
 * Hallway model: each year-door is Jan 1 of that year; salary for the year is
 * included in this step's cashflow (paid as the player walks between doors,
 * available before/at the door). Snapshots used for glass-wall insolvency
 * therefore already reflect that year's salary.
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

  // Equity returns — stocks + 401(k) (retirement accounts are invested)
  // Deterministic (no noise) when projecting hallway HUD
  {
    const ret = difficulty.equityReturn;
    const noise = opts.deterministic ? 1 : 1 + (rng() * 0.04 - 0.02);
    if (next.stocksTotal > 0) {
      const gain = Math.round(next.stocksTotal * ret * noise);
      next.stocksTotal = Math.max(0, next.stocksTotal + gain);
      events.push(`Market return (stocks): ${gain >= 0 ? '+' : ''}$${fmt(gain)}`);
    }
    if ((next.k401Balance || 0) > 0) {
      const kNoise = opts.deterministic ? 1 : 1 + (rng() * 0.04 - 0.02);
      const kGain = Math.round(next.k401Balance * ret * kNoise);
      next.k401Balance = Math.max(0, next.k401Balance + kGain);
      events.push(`401(k) return: ${kGain >= 0 ? '+' : ''}$${fmt(kGain)}`);
    }
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

  // Financed purchases + HELOC / securities-backed loans (amortizing P&I → cash-flow expense)
  let otherLoanPaid = 0;
  for (const loan of next.otherLoans || []) {
    if ((loan.principal || 0) <= 0 || (loan.remainingTerm || 0) <= 0) continue;
    const interest = Math.round((loan.principal || 0) * (loan.rate || 0));
    let annual = annualLoanPayment(loan);
    let principalPay = Math.min(loan.principal, Math.max(0, annual - interest));
    // Final year: clear residual principal so the loan doesn't stick
    if ((loan.remainingTerm || 0) <= 1) {
      principalPay = loan.principal;
      annual = principalPay + interest;
    }
    loan.principal = Math.max(0, loan.principal - principalPay);
    loan.remainingTerm = Math.max(0, (loan.remainingTerm || 0) - 1);
    otherLoanPaid += Math.round(annual);
    if (loan.type === 'heloc' || loan.type === 'securities') {
      events.push(
        `${loan.label || loan.type}: payment $${fmt(annual)} (interest $${fmt(interest)})`
      );
    }
    if (loan.principal < 1) {
      loan.principal = 0;
      loan.remainingTerm = 0;
      events.push(`Paid off: ${loan.label || 'financed purchase'}.`);
    }
  }
  next.otherLoans = (next.otherLoans || []).filter((l) => (l.principal || 0) > 0);

  // Annual USDA-style child costs (every year, age-banded; stops before college ages)
  let childCosts = 0;
  for (const kid of next.kids || []) {
    const c = annualChildCost(kid.age, difficulty, next.childCostInflator);
    if (c > 0) {
      childCosts += c;
      events.push(`Child cost (${kid.name || 'child'}, age ${kid.age}): −$${fmt(c)}`);
    }
  }

  // Annual college tuition (NATIONAL_AVG × pressure × inflator) — ages 18–21; no double-count with child bands
  let collegeTuition = 0;
  for (const kid of next.kids || []) {
    const a = kid.age || 0;
    if (a < COLLEGE_AGE_MIN || a > COLLEGE_AGE_MAX) continue;
    const cost = Math.round(
      NATIONAL_AVG_COLLEGE_COST *
        (difficulty.expensePressure || 1) *
        (next.childCostInflator || 1)
    );
    collegeTuition += cost;
    events.push(`${kid.name || 'Child'} — college tuition: −$${fmt(cost)}`);
  }

  // 401(k) employee deferral + employer match (while employed; before tax & surplus)
  let k401Deferral = 0;
  let k401Match = 0;
  if (next.employed && !next.retired && (next.salary || 0) > 0) {
    k401Deferral = employee401kDeferral(next);
    k401Match = employer401kMatch(next, k401Deferral);
    if (k401Deferral > 0 || k401Match > 0) {
      next.k401Balance = (next.k401Balance || 0) + k401Deferral + k401Match;
      if (k401Deferral > 0) {
        events.push(`401(k) deferral: $${fmt(k401Deferral)} (from paycheck)`);
      }
      if (k401Match > 0) {
        events.push(`Employer 401(k) match: +$${fmt(k401Match)}`);
      }
    }
  }

  // Taxes (traditional 401(k) deferral reduces taxable wages via Tax.js)
  const tax = estimateAnnualTax(next, difficulty);
  const incomeTax = tax.federal + tax.state;
  const propertyTax = tax.property;

  // Cash flow: salary + SS in; spending + taxes + mortgage + loans + deferral out
  // Deferral reduces disposable income (paycheck deduction) — do not also cut salary inflow
  const inflow =
    (next.retired ? 0 : next.salary || 0) + (next.socialSecurity || 0);
  const stated = next.annualSpending || 0;
  const statedHasMortgage = !!(next.spendingBreakdown?.mortgage);
  const outflow =
    stated * difficulty.expensePressure +
    (statedHasMortgage ? 0 : mortgagePaid) +
    otherLoanPaid +
    incomeTax +
    propertyTax +
    childCosts +
    collegeTuition +
    k401Deferral;

  const net = inflow - outflow;
  if (net >= 0) {
    next.cash = (next.cash || 0) + Math.round(net);
    events.push(`Year surplus → Cash: +$${fmt(net)}`);
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
    // Retired: auto-withdraw from 401(k) → Cash to cover remaining shortfall (taxable)
    if (left > 0 && next.retired && (next.k401Balance || 0) > 0) {
      const drawn = withdraw401kToCover(next, left, difficulty, events);
      left = Math.max(0, left - drawn);
    }
    if (left > 0) {
      next.otherDebt = (next.otherDebt || 0) + left;
      events.push(`Shortfall borrowed: +$${fmt(left)} debt`);
    } else if (need > 0) {
      events.push(`Year deficit covered from liquid assets: −$${fmt(need)}`);
    }
  }

  // If retired and Cash still < 0 (edge), pull from 401(k) to zero Cash
  if (next.retired && (next.cash || 0) < 0 && (next.k401Balance || 0) > 0) {
    const short = Math.round(-(next.cash || 0));
    withdraw401kToCover(next, short, difficulty, events);
  }

  // Securities-backed loan maintenance (margin call if over SB_LTV)
  applySecuritiesMarginCall(next, events);

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
  if (debugOn()) {
    const cashBefore = state.cash || 0;
    const cashAfter = next.cash || 0;
    debugLog('year', {
      year: next.year,
      age: next.age,
      salary: next.retired ? 0 : next.salary || 0,
      socialSecurity: next.socialSecurity || 0,
      employed: !!next.employed && !next.retired,
      retired: !!next.retired,
      spendingUsed: stated,
      inflow,
      outflow: Math.round(outflow),
      net: Math.round(net),
      cashBefore,
      cashAfter,
      cashDelta: Math.round(cashAfter - cashBefore),
      surplusEvent: events.find((e) => /surplus → Cash/i.test(e)) || null,
    });
  }
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


/**
 * First projected year index (1-based years from baseline) where Cash (`cash`) ≤ 0
 * after that year's full cashflow — including salary (see projectOneYear).
 * snapshots[0] is the leave baseline; snapshots[k] is after k years / at door k.
 * Glass wall sits past door k-1 (last enterable) and blocks door k.
 * @param {Array<{state?:object, worth?:object}>} snapshots
 * @returns {number} index k >= 1, or -1 if never insolvent
 */
export function findBankInsolvencyIndex(snapshots) {
  if (!snapshots?.length) return -1;
  for (let k = 1; k < snapshots.length; k++) {
    const cash = snapshots[k].state?.cash ?? snapshots[k].worth?.bank ?? 0;
    if (cash <= 0) return k;
  }
  return -1;
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

  // Real-world lien: pay off HELOCs on this home from sale proceeds
  let helocOwed = 0;
  next.otherLoans = (next.otherLoans || []).filter((loan) => {
    if (loan.type === 'heloc' && loan.homeIndex === index) {
      helocOwed += loan.principal || 0;
      return false;
    }
    return true;
  });

  const net = (home.value || 0) - (home.mortgageOwed || 0) - helocOwed;
  if (net >= 0) {
    next.cash = (next.cash || 0) + net;
  } else {
    payFromLiquid(next, -net);
  }

  next.homes.splice(index, 1);

  // Renumber HELOC homeIndex after splice
  for (const loan of next.otherLoans || []) {
    if (loan.type === 'heloc' && (loan.homeIndex || 0) > index) {
      loan.homeIndex--;
    }
  }
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

/**
 * Drain liquid assets (cash → savings → stocks) for `amount`.
 * Shortfall adds to otherDebt. Mutates `next` in place.
 */
function payFromLiquid(next, amount) {
  let left = Math.max(0, Math.round(amount));
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
  return left;
}

/**
 * Large purchase — cash or financed.
 * @param {object} state
 * @param {number} amount purchase price
 * @param {object} [opts]
 * @param {boolean} [opts.financed]
 * @param {number} [opts.downPayment] dollars (capped at amount)
 * @param {number} [opts.rate] annual decimal (e.g. 0.069)
 * @param {number} [opts.term] years (default 5)
 * @param {string} [opts.label]
 */
export function largePurchase(state, amount, opts = {}) {
  const next = cloneState(state);
  const price = Math.max(0, Math.round(amount || 0));
  if (price <= 0) return next;

  const label = (opts.label && String(opts.label).trim()) || 'Large Purchase';

  if (!opts.financed) {
    payFromLiquid(next, price);
    next.milestones = next.milestones || [];
    next.milestones.push({
      year: next.year,
      age: next.age,
      message: `Purchased ${label}`,
    });
    return next;
  }

  const down = Math.max(0, Math.min(price, Math.round(opts.downPayment || 0)));
  const principal = price - down;
  const rate = Math.max(0, Number(opts.rate) || 0);
  const term = Math.max(1, Math.round(opts.term || 5));

  payFromLiquid(next, down);

  next.milestones = next.milestones || [];
  next.milestones.push({
    year: next.year,
    age: next.age,
    message: `Purchased ${label}`,
  });

  if (principal > 0) {
    next.otherLoans = next.otherLoans || [];
    next.otherLoans.push({
      label,
      principal,
      rate,
      remainingTerm: term,
      originalAmount: principal,
    });
  }
  return next;
}


/**
 * Available HELOC credit on one home: max(0, HELOC_CLTV * value − mortgage − existing HELOCs).
 */
export function helocCapacity(state, homeIndex) {
  const home = state.homes?.[homeIndex];
  if (!home) return 0;
  const value = home.value || 0;
  const mortgage = home.mortgageOwed || 0;
  let existing = 0;
  for (const loan of state.otherLoans || []) {
    if (loan.type === 'heloc' && loan.homeIndex === homeIndex) {
      existing += loan.principal || 0;
    }
  }
  return Math.max(0, Math.round(HELOC_CLTV * value - mortgage - existing));
}

/**
 * Available securities-backed loan capacity against taxable brokerage only.
 * max(0, SB_LTV * stocksTotal − existing securities loan principals).
 */
export function securitiesLoanCapacity(state) {
  let existing = 0;
  for (const loan of state.otherLoans || []) {
    if (loan.type === 'securities') existing += loan.principal || 0;
  }
  return Math.max(0, Math.round(SB_LTV * (state.stocksTotal || 0) - existing));
}

/**
 * Open a HELOC: proceeds → Cash. Amortizing otherLoans entry type 'heloc'.
 */
export function takeHeloc(state, opts = {}) {
  const next = cloneState(state);
  const homeIndex = Number(opts.homeIndex);
  const cap = helocCapacity(next, homeIndex);
  const amount = Math.max(0, Math.min(cap, Math.round(Number(opts.amount) || 0)));
  if (amount <= 0 || !next.homes?.[homeIndex]) return next;

  const rate = Math.max(0, Number(opts.rate) || HELOC_DEFAULT_RATE);
  const term = Math.max(1, Math.round(opts.term || 15));
  const home = next.homes[homeIndex];
  next.otherLoans = next.otherLoans || [];
  next.otherLoans.push({
    type: 'heloc',
    homeIndex,
    label: opts.label || `HELOC — ${home.label || home.type || 'Home'}`,
    principal: amount,
    rate,
    remainingTerm: term,
    originalAmount: amount,
  });
  next.cash = (next.cash || 0) + amount;
  return next;
}

/**
 * Securities-backed loan against stocksTotal. Proceeds → Cash.
 */
export function takeSecuritiesLoan(state, opts = {}) {
  const next = cloneState(state);
  const cap = securitiesLoanCapacity(next);
  const amount = Math.max(0, Math.min(cap, Math.round(Number(opts.amount) || 0)));
  if (amount <= 0) return next;

  const rate = Math.max(0, Number(opts.rate) || SECURITIES_LOAN_DEFAULT_RATE);
  const term = Math.max(1, Math.round(opts.term || 10));
  next.otherLoans = next.otherLoans || [];
  next.otherLoans.push({
    type: 'securities',
    label: opts.label || 'Loan against shares',
    principal: amount,
    rate,
    remainingTerm: term,
    originalAmount: amount,
  });
  next.cash = (next.cash || 0) + amount;
  return next;
}

/**
 * If securities loan principal > SB_LTV * stocks, liquidate stocks → Cash → pay down loan.
 */
function applySecuritiesMarginCall(next, events) {
  const sbLoans = (next.otherLoans || []).filter((l) => l.type === 'securities' && (l.principal || 0) > 0);
  if (!sbLoans.length) return;
  let principal = sbLoans.reduce((s, l) => s + (l.principal || 0), 0);
  const maxAllowed = Math.round(SB_LTV * (next.stocksTotal || 0));
  if (principal <= maxAllowed) return;

  let excess = principal - maxAllowed;
  events.push(`Margin call: loan against shares over ${Math.round(SB_LTV * 100)}% LTV by $${fmt(excess)}.`);

  // Sell stocks into Cash, then pay down securities loans
  const sellAmt = Math.min(next.stocksTotal || 0, excess);
  if (sellAmt > 0 && (next.stocksTotal || 0) > 0) {
    const ratio = sellAmt / next.stocksTotal;
    next.stocksCostBasis = Math.max(0, Math.round((next.stocksCostBasis || 0) * (1 - ratio)));
    next.stocksTotal -= sellAmt;
    next.cash = (next.cash || 0) + sellAmt;
    events.push(`Margin call: sold $${fmt(sellAmt)} stock → Cash.`);
  }

  let pay = Math.min(next.cash || 0, excess);
  next.cash = (next.cash || 0) - pay;
  for (const loan of sbLoans) {
    if (pay <= 0) break;
    const take = Math.min(loan.principal || 0, pay);
    loan.principal -= take;
    pay -= take;
    excess -= take;
  }
  next.otherLoans = (next.otherLoans || []).filter((l) => (l.principal || 0) > 0);
  if (excess > 0.5) {
    events.push(`Margin call: still $${fmt(excess)} over LTV after liquidation.`);
  }
}

/**
 * While retired: withdraw from traditional 401(k) to cover a Cash shortfall.
 * Withdrawals are taxable ordinary income (Tax.js incremental); net → Cash.
 * @returns {number} net dollars applied toward the shortfall
 */
function withdraw401kToCover(next, needNet, difficulty, events) {
  const need = Math.max(0, Math.round(needNet || 0));
  let bal = next.k401Balance || 0;
  if (need <= 0 || bal <= 0) return 0;

  // Gross-up for tax so net proceeds cover `need` when balance allows
  let gross = Math.min(bal, need);
  let taxInfo = estimateTaxOnExtraIncome(next, difficulty, gross);
  let tax = taxInfo.total || 0;
  let net = Math.max(0, gross - tax);
  if (net < need && gross < bal) {
    const r = gross > 0 ? tax / gross : 0.22;
    gross = Math.min(bal, Math.ceil(need / Math.max(0.05, 1 - r)));
    taxInfo = estimateTaxOnExtraIncome(next, difficulty, gross);
    tax = taxInfo.total || 0;
    net = Math.max(0, gross - tax);
  }

  next.k401Balance = bal - gross;
  next.cash = Math.round((next.cash || 0) + net);
  events.push(`401(k) withdrawal → Cash: $${fmt(net)} (tax $${fmt(tax)})`);
  return net;
}

function fmt(n) {
  return Math.round(n).toLocaleString('en-US');
}

export { liquidTotal, estimateCapitalGainsTax };
