/**
 * Automatic life/finance events applied when projecting a year.
 */

import { RETIREMENT_AGE } from '../config.js';

/**
 * @param {object} state - mutable clone of financial state at start of year
 * @param {object} difficulty
 * @returns {string[]} event descriptions for UI/log
 */
export function applyAutoEvents(state, difficulty) {
  const log = [];

  // Retirement
  if (state.age >= RETIREMENT_AGE && state.employed && !state.retired) {
    state.retired = true;
    state.employed = false;
    state.salary = 0;
    log.push(`Retired at age ${state.age}. Salary set to $0.`);
  }

  // Kids college (ages 18–22 inclusive)
  for (const kid of state.kids || []) {
    const kidAge = kid.age;
    if (kidAge >= 18 && kidAge <= 22) {
      const cost = difficulty.collegeCost || 25000;
      const paid = Math.min(state.cash + state.savings, cost);
      drainLiquid(state, paid);
      log.push(`College costs for ${kid.name || 'child'} (age ${kidAge}): −$${fmt(paid)}`);
    }
  }

  // Mortgage payoff detection (after payment loop in Engine)
  for (const home of state.homes || []) {
    if (home.mortgageOwed > 0 && home.mortgageOwed < 1) {
      home.mortgageOwed = 0;
      home.remainingTerm = 0;
      log.push(`Mortgage paid off: ${home.label || home.type}.`);
    }
  }

  // Large unexpected expense (rare, difficulty-scaled)
  if (Math.random() < 0.04 * (difficulty.expensePressure || 1)) {
    const hit = Math.round(2000 + Math.random() * 8000 * (difficulty.expensePressure || 1));
    const paid = Math.min(liquidTotal(state), hit);
    drainLiquid(state, paid);
    log.push(`Unexpected expense: −$${fmt(paid)}`);
  }

  return log;
}

function liquidTotal(state) {
  return (state.cash || 0) + (state.savings || 0) + (state.stocksTotal || 0);
}

function drainLiquid(state, amount) {
  let left = amount;
  const fromCash = Math.min(state.cash || 0, left);
  state.cash = (state.cash || 0) - fromCash;
  left -= fromCash;
  if (left <= 0) return;
  const fromSav = Math.min(state.savings || 0, left);
  state.savings = (state.savings || 0) - fromSav;
  left -= fromSav;
  if (left <= 0) return;
  const fromStocks = Math.min(state.stocksTotal || 0, left);
  state.stocksTotal = (state.stocksTotal || 0) - fromStocks;
  // Scale ticker entries proportionally
  if (state.tickers?.length && state.stocksTotal >= 0) {
    const oldTotal = state.stocksTotal + fromStocks;
    if (oldTotal > 0) {
      const ratio = state.stocksTotal / oldTotal;
      for (const t of state.tickers) t.amount = Math.round((t.amount || 0) * ratio);
    }
  }
}

function fmt(n) {
  return Math.round(n).toLocaleString('en-US');
}

export { liquidTotal, drainLiquid };
