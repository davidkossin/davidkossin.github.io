/**
 * Authoritative game state + timeline branch nodes.
 */

import { CURRENT_YEAR, MAX_AGE } from '../config.js';
import { cloneState, computeWorth } from '../finance/Engine.js';

export function createDefaultSetup() {
  return {
    playerName: 'Traveler',
    year: CURRENT_YEAR,
    age: 30,
    hairColor: 'dark', // dark | blonde | red
    hairLength: 'short', // long | short
    cash: 5000,
    salary: 65000,
    savings: 20000,
    savingsRate: 0.02,
    homes: [],
    stocksTotal: 10000,
    tickers: [],
    married: false,
    kids: [],
    annualSpending: 35000,
    spendingBreakdown: {
      incomeTax: 0,
      mortgage: 0,
      propertyTax: 0,
      other: 35000,
    },
    zip: '85001',
    difficulty: 'standard',
    employed: true,
    retired: false,
    otherDebt: 0,
  };
}

/**
 * Build runtime game state from completed setup answers.
 */
export function createGameFromSetup(setup) {
  const portfolio = {
    playerName: setup.playerName || 'Traveler',
    year: setup.year || CURRENT_YEAR,
    age: setup.age || 30,
    hairColor: setup.hairColor || 'dark',
    hairLength: setup.hairLength || 'short',
    cash: Number(setup.cash) || 0,
    salary: Number(setup.salary) || 0,
    savings: Number(setup.savings) || 0,
    savingsRate: Number(setup.savingsRate) || 0.02,
    homes: (setup.homes || []).map((h, i) => ({
      type: h.type || 'primary',
      label: h.label || `Home ${i + 1}`,
      value: Number(h.value) || 0,
      mortgageOwed: Number(h.mortgageOwed) || 0,
      rate: Number(h.rate) || 0.065,
      remainingTerm: Number(h.remainingTerm) || 30,
      propertyTaxRate: Number(h.propertyTaxRate) || 0.012,
    })),
    stocksTotal: Number(setup.stocksTotal) || 0,
    tickers: (setup.tickers || []).map((t) => ({
      symbol: t.symbol || 'ETF',
      amount: Number(t.amount) || 0,
    })),
    married: !!setup.married,
    kids: (setup.kids || []).map((k, i) => ({
      name: k.name || `Child ${i + 1}`,
      age: Number(k.age) || 0,
    })),
    annualSpending: Number(setup.annualSpending) || 30000,
    spendingBreakdown: setup.spendingBreakdown || { other: Number(setup.annualSpending) || 30000 },
    zip: String(setup.zip || '85001'),
    difficulty: setup.difficulty || 'standard',
    employed: setup.employed !== false && (Number(setup.salary) || 0) > 0,
    retired: !!setup.retired,
    otherDebt: Number(setup.otherDebt) || 0,
  };

  const nodeId = `y${portfolio.year}-start`;
  const worth = computeWorth(portfolio);

  return {
    scene: 'room',
    portfolio,
    /** Timeline: each Decision Room visit creates/updates a node. */
    timeline: {
      nodes: {
        [nodeId]: {
          id: nodeId,
          year: portfolio.year,
          age: portfolio.age,
          kind: 'begin', // begin | end
          baseline: cloneState(portfolio), // post-decision state used for hallway projection
          parentId: null,
        },
      },
      currentNodeId: nodeId,
      startAge: portfolio.age,
      startYear: portfolio.year,
    },
    flags: {
      setupComplete: true,
    },
    lastWorth: worth,
    eventLog: [],
  };
}

export function currentNode(game) {
  return game.timeline.nodes[game.timeline.currentNodeId];
}

/**
 * Snapshot portfolio into current timeline node as hallway baseline
 * (call when leaving Decision Room → Hallway, or on auto-save).
 */
export function commitRoomDecisions(game, kind = 'end') {
  const p = game.portfolio;
  const id = `y${p.year}-${kind}`;
  const parentId = game.timeline.currentNodeId;
  game.timeline.nodes[id] = {
    id,
    year: p.year,
    age: p.age,
    kind,
    baseline: cloneState(p),
    parentId,
  };
  game.timeline.currentNodeId = id;
  game.lastWorth = computeWorth(p);
  return id;
}

/**
 * Enter a year's Decision Room from hallway door.
 * Branches from the projected state at that year.
 */
export function enterYearRoom(game, projectedPortfolio) {
  const p = cloneState(projectedPortfolio);
  game.portfolio = p;
  const id = `y${p.year}-begin`;
  game.timeline.nodes[id] = {
    id,
    year: p.year,
    age: p.age,
    kind: 'begin',
    baseline: cloneState(p),
    parentId: game.timeline.currentNodeId,
  };
  game.timeline.currentNodeId = id;
  game.lastWorth = computeWorth(p);
  game.scene = 'room';
  return id;
}

export function yearsRemaining(game) {
  return Math.max(0, MAX_AGE - game.portfolio.age);
}

export function hallwayDoorCount(game) {
  // doors for each year from startAge to 99 (age 100 is End of the Line)
  const start = game.timeline.startAge;
  return Math.max(0, MAX_AGE - start);
}
