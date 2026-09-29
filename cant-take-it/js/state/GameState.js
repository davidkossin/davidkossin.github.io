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
    hairColor: 'dark',
    hairLength: 'short',
    cash: 5000,
    salary: 65000,
    savings: 20000,
    savingsRate: 0.02, // decimal; UI enters percent
    homes: [],
    stocksTotal: 10000,
    stocksCostBasis: 10000,
    k401Balance: 0,
    k401ContribRate: 0.06, // decimal; UI enters percent of salary
    k401MatchRate: 1.0, // employer matches this fraction of deferrals (1.0 = 100%)
    k401MatchOnFirst: 0.03, // match applies on first X of salary (0.03 = 3%)
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
    otherLoans: [],
    milestones: [],
  };
}

/**
 * Build runtime game state from completed setup answers.
 */
export function createGameFromSetup(setup) {
  const stocks = Number(setup.stocksTotal) || 0;
  const portfolio = {
    playerName: setup.playerName || 'Traveler',
    year: setup.year || CURRENT_YEAR,
    age: setup.age || 30,
    hairColor: setup.hairColor || 'dark',
    hairLength: setup.hairLength || 'short',
    cash: Number(setup.cash) || 0,
    salary: Number(setup.salary) || 0,
    peakSalary: Number(setup.salary) || 0,
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
    stocksTotal: stocks,
    stocksCostBasis: Number(setup.stocksCostBasis) >= 0 ? Number(setup.stocksCostBasis) : stocks,
    k401Balance: Math.max(0, Number(setup.k401Balance) || 0),
    k401ContribRate: Math.max(0, Math.min(1, Number(setup.k401ContribRate) || 0)),
    k401MatchRate: Math.max(0, Math.min(1, Number(setup.k401MatchRate) || 0)),
    k401MatchOnFirst: Math.max(0, Math.min(1, Number(setup.k401MatchOnFirst) || 0)),
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
    otherLoans: Array.isArray(setup.otherLoans) ? setup.otherLoans : [],
    milestones: Array.isArray(setup.milestones) ? setup.milestones : [],
    socialSecurity: 0,
    childCostInflator: 1,
  };

  const nodeId = `room-${portfolio.year}-0`;
  const worth = computeWorth(portfolio);
  const snapshotId = `snap-${nodeId}`;

  const game = {
    scene: 'room',
    portfolio,
    timeline: {
      nodes: {
        [nodeId]: {
          id: nodeId,
          year: portfolio.year,
          age: portfolio.age,
          type: 'room', // room | hallway
          kind: 'begin',
          parentId: null,
          snapshotId,
          label: `Decision Room ${portfolio.year}`,
        },
      },
      snapshots: {
        [snapshotId]: cloneState(portfolio),
      },
      currentNodeId: nodeId,
      startAge: portfolio.age,
      startYear: portfolio.year,
      branchCounter: 0,
    },
    /** Net worth series for Charts tab / ending */
    worthHistory: [
      {
        year: portfolio.year,
        age: portfolio.age,
        netWorth: worth.netWorth,
        bank: worth.bank,
        portfolio: worth.portfolio,
        salary: portfolio.salary || 0,
      },
    ],
    flags: {
      setupComplete: true,
    },
    lastWorth: worth,
    eventLog: [],
  };

  return game;
}

export function currentNode(game) {
  return game.timeline.nodes[game.timeline.currentNodeId];
}

export function getSnapshot(game, snapshotId) {
  return game.timeline.snapshots[snapshotId];
}

function nextBranchId(game, prefix, year) {
  game.timeline.branchCounter = (game.timeline.branchCounter || 0) + 1;
  return `${prefix}-${year}-${game.timeline.branchCounter}`;
}

function pushWorth(game, p) {
  const worth = computeWorth(p);
  game.worthHistory = game.worthHistory || [];
  const last = game.worthHistory[game.worthHistory.length - 1];
  if (last && last.year === p.year && last.age === p.age) {
    last.netWorth = worth.netWorth;
    last.bank = worth.bank;
    last.portfolio = worth.portfolio;
    last.salary = p.salary || 0;
  } else {
    game.worthHistory.push({
      year: p.year,
      age: p.age,
      netWorth: worth.netWorth,
      bank: worth.bank,
      portfolio: worth.portfolio,
      salary: p.salary || 0,
    });
  }
  game.lastWorth = worth;
}

/**
 * Snapshot portfolio into a room timeline node (begin/end of year).
 */
export function commitRoomDecisions(game, kind = 'end') {
  const p = game.portfolio;
  const id = nextBranchId(game, `room-${kind}`, p.year);
  const snapshotId = `snap-${id}`;
  const parentId = game.timeline.currentNodeId;
  game.timeline.snapshots[snapshotId] = cloneState(p);
  game.timeline.nodes[id] = {
    id,
    year: p.year,
    age: p.age,
    type: 'room',
    kind,
    parentId,
    snapshotId,
    label: kind === 'end' ? `Left room ${p.year}` : `Decision Room ${p.year}`,
  };
  game.timeline.currentNodeId = id;
  pushWorth(game, p);
  return id;
}

/**
 * Record entering the Hallway of Time (for pause map jump-back).
 */
export function commitHallwayNode(game) {
  const p = game.portfolio;
  const id = nextBranchId(game, 'hallway', p.year);
  const snapshotId = `snap-${id}`;
  game.timeline.snapshots[snapshotId] = cloneState(p);
  game.timeline.nodes[id] = {
    id,
    year: p.year,
    age: p.age,
    type: 'hallway',
    kind: 'hallway',
    parentId: game.timeline.currentNodeId,
    snapshotId,
    label: `Hallway after ${p.year}`,
  };
  game.timeline.currentNodeId = id;
  pushWorth(game, p);
  return id;
}

/**
 * Enter a year's Decision Room from hallway door.
 */
export function enterYearRoom(game, projectedPortfolio) {
  const p = cloneState(projectedPortfolio);
  game.portfolio = p;
  const id = nextBranchId(game, 'room-begin', p.year);
  const snapshotId = `snap-${id}`;
  game.timeline.snapshots[snapshotId] = cloneState(p);
  game.timeline.nodes[id] = {
    id,
    year: p.year,
    age: p.age,
    type: 'room',
    kind: 'begin',
    parentId: game.timeline.currentNodeId,
    snapshotId,
    label: `Decision Room ${p.year}`,
  };
  game.timeline.currentNodeId = id;
  pushWorth(game, p);
  game.scene = 'room';
  return id;
}

/**
 * Jump back to a prior Hallway of Time node — restore that branch state.
 * Truncates worthHistory to the jump point year where possible.
 */
export function jumpToHallwayNode(game, nodeId) {
  const node = game.timeline.nodes[nodeId];
  if (!node || node.type !== 'hallway') return false;
  const snap = game.timeline.snapshots[node.snapshotId];
  if (!snap) return false;
  game.portfolio = cloneState(snap);
  game.timeline.currentNodeId = nodeId;
  game.scene = 'hallway';
  // Trim history to entries at or before this node's year/age
  if (game.worthHistory?.length) {
    game.worthHistory = game.worthHistory.filter(
      (h) => h.year < node.year || (h.year === node.year && h.age <= node.age)
    );
    if (!game.worthHistory.length) {
      const w = computeWorth(game.portfolio);
      game.worthHistory = [
        {
          year: game.portfolio.year,
          age: game.portfolio.age,
          netWorth: w.netWorth,
          bank: w.bank,
          portfolio: w.portfolio,
          salary: game.portfolio.salary || 0,
        },
      ];
    }
  }
  game.lastWorth = computeWorth(game.portfolio);
  return true;
}

export function listTimelineNodes(game) {
  return Object.values(game.timeline.nodes || {}).sort((a, b) => {
    if (a.year !== b.year) return a.year - b.year;
    return String(a.id).localeCompare(String(b.id));
  });
}

export function yearsRemaining(game) {
  return Math.max(0, MAX_AGE - game.portfolio.age);
}

export function hallwayDoorCount(game) {
  // Doors from leaveAge+1 through age 99
  const leaveAge = game.portfolio.age;
  return Math.max(0, MAX_AGE - leaveAge - 1);
}


/**
 * Children of each timeline node (parentId → child ids).
 * @param {object} game
 * @returns {Map<string, string[]>}
 */
export function timelineChildrenMap(game) {
  const map = new Map();
  for (const n of Object.values(game.timeline?.nodes || {})) {
    if (!n?.id) continue;
    if (n.parentId) {
      if (!map.has(n.parentId)) map.set(n.parentId, []);
      map.get(n.parentId).push(n.id);
    }
  }
  for (const kids of map.values()) {
    kids.sort((a, b) => {
      const na = game.timeline.nodes[a];
      const nb = game.timeline.nodes[b];
      if (na.year !== nb.year) return na.year - nb.year;
      return String(a).localeCompare(String(b));
    });
  }
  return map;
}

/**
 * Root → node path (inclusive).
 * @param {object} game
 * @param {string} nodeId
 * @returns {object[]}
 */
export function pathFromRoot(game, nodeId) {
  const path = [];
  let id = nodeId;
  const guard = new Set();
  while (id && !guard.has(id)) {
    guard.add(id);
    const n = game.timeline.nodes[id];
    if (!n) break;
    path.push(n);
    id = n.parentId;
  }
  path.reverse();
  return path;
}

/**
 * Leaf tips of the timeline tree (nodes with no children).
 * @param {object} game
 * @returns {object[]}
 */
export function listBranchTips(game) {
  const nodes = game.timeline?.nodes || {};
  const kids = timelineChildrenMap(game);
  return Object.values(nodes)
    .filter((n) => !kids.has(n.id) || kids.get(n.id).length === 0)
    .sort((a, b) => {
      if (a.year !== b.year) return a.year - b.year;
      return String(a.id).localeCompare(String(b.id));
    });
}

/**
 * Rebuild a worth series from portfolio snapshots along root→tip.
 * @param {object} game
 * @param {string} tipNodeId
 * @returns {Array<{year:number,age:number,netWorth:number,bank:number,portfolio:number,salary:number}>}
 */
export function reconstructWorthAlongPath(game, tipNodeId) {
  const path = pathFromRoot(game, tipNodeId);
  const history = [];
  for (const n of path) {
    const snap = game.timeline.snapshots?.[n.snapshotId];
    if (!snap) continue;
    const worth = computeWorth(snap);
    const row = {
      year: snap.year ?? n.year,
      age: snap.age ?? n.age,
      netWorth: worth.netWorth,
      bank: worth.bank,
      portfolio: worth.portfolio,
      salary: snap.salary || 0,
      retired: !!snap.retired,
      nodeId: n.id,
      snapshotId: n.snapshotId,
    };
    const last = history[history.length - 1];
    if (last && last.year === row.year && last.age === row.age) {
      Object.assign(last, row);
    } else {
      history.push(row);
    }
  }
  return history;
}

const BRANCH_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

/**
 * Distinct explored timelines (one per leaf tip), labeled A/B/C…
 * `isCurrent` marks the tip whose path contains currentNodeId (prefer deepest).
 * @param {object} game
 * @returns {Array<{letter:string,label:string,tipId:string,tip:object,history:array,isCurrent:boolean,yearMin:number,yearMax:number}>}
 */
export function listCompareBranches(game) {
  const tips = listBranchTips(game);
  const currentId = game.timeline?.currentNodeId;
  let currentTipId = null;
  if (currentId) {
    // Prefer a tip that descends from / is the current node
    for (const tip of tips) {
      const path = pathFromRoot(game, tip.id);
      if (path.some((n) => n.id === currentId)) {
        currentTipId = tip.id;
        break;
      }
    }
  }

  return tips.map((tip, i) => {
    const history = reconstructWorthAlongPath(game, tip.id);
    const letter = BRANCH_LETTERS[i] || String(i + 1);
    const forkLabel = tip.label || `Tip ${tip.year}`;
    const yearMin = history.length ? history[0].year : tip.year;
    const yearMax = history.length ? history[history.length - 1].year : tip.year;
    return {
      letter,
      label: `Timeline ${letter}`,
      shortLabel: letter,
      tipId: tip.id,
      tip,
      history,
      isCurrent: tip.id === currentTipId,
      yearMin,
      yearMax,
      forkLabel,
    };
  });
}

/**
 * Best portfolio snapshot on a branch for a calendar year.
 * Prefers the latest node on that path with snap.year === year;
 * falls back to nearest earlier year only when status would otherwise be missing mid-span
 * (we report exact-year only for side-by-side clarity — before/after otherwise).
 *
 * @param {object} game
 * @param {string} tipNodeId
 * @param {number} year
 * @returns {{status:'ok'|'before'|'after'|'empty', year:number, age?:number, portfolio?:object, worth?:object, node?:object}}
 */
export function portfolioAtYearOnBranch(game, tipNodeId, year) {
  const y = Math.round(Number(year));
  if (!Number.isFinite(y)) {
    return { status: 'empty', year: y };
  }
  const path = pathFromRoot(game, tipNodeId);
  if (!path.length) return { status: 'empty', year: y };

  const withSnaps = [];
  for (const n of path) {
    const snap = game.timeline.snapshots?.[n.snapshotId];
    if (!snap) continue;
    withSnaps.push({ node: n, snap, year: snap.year ?? n.year, age: snap.age ?? n.age });
  }
  if (!withSnaps.length) return { status: 'empty', year: y };

  const yearMin = withSnaps[0].year;
  const yearMax = withSnaps[withSnaps.length - 1].year;
  if (y < yearMin) {
    return { status: 'before', year: y, yearMin, yearMax };
  }
  if (y > yearMax) {
    return { status: 'after', year: y, yearMin, yearMax };
  }

  // Exact year only — mid-span gaps (e.g. spawned into a later door) are n/a
  const exact = withSnaps.filter((s) => s.year === y);
  if (exact.length) {
    const pick = exact[exact.length - 1];
    return {
      status: 'ok',
      year: y,
      age: pick.age,
      portfolio: pick.snap,
      worth: computeWorth(pick.snap),
      node: pick.node,
      yearMin,
      yearMax,
    };
  }

  return { status: 'gap', year: y, yearMin, yearMax };
}

/**
 * Layout positions for pause Timeline Map.
 * Time flows DOWN the main spine (past → future); forks spawn RIGHT.
 *
 * @param {object} game
 * @param {{x:number,y:number,w:number,h:number}} rect
 * @returns {{positions: Map<string,{x:number,y:number,node:object,lane:number}>, edges: Array<{from:string,to:string}>, orientation:string}}
 */
export function layoutTimelineMap(game, rect) {
  const nodes = game.timeline?.nodes || {};
  const list = Object.values(nodes);
  const kids = timelineChildrenMap(game);
  const root = list.find((n) => !n.parentId) || list[0];
  if (!root) {
    return { positions: new Map(), edges: [], orientation: 'vertical-down' };
  }

  // Prefer current path as lane 0 (main spine)
  const currentPath = new Set(
    pathFromRoot(game, game.timeline.currentNodeId || root.id).map((n) => n.id)
  );

  const laneOf = new Map();
  let nextLane = 1;

  function assign(id, preferredLane) {
    if (laneOf.has(id)) return;
    laneOf.set(id, preferredLane);
    const children = kids.get(id) || [];
    // Keep current-path child on same lane; others fork right
    const ordered = [...children].sort((a, b) => {
      const ac = currentPath.has(a) ? 0 : 1;
      const bc = currentPath.has(b) ? 0 : 1;
      if (ac !== bc) return ac - bc;
      return String(a).localeCompare(String(b));
    });
    let forked = false;
    for (const cid of ordered) {
      if (!forked && (currentPath.has(cid) || ordered.length === 1)) {
        assign(cid, preferredLane);
        forked = true;
      } else if (!forked) {
        assign(cid, preferredLane);
        forked = true;
      } else {
        const lane = nextLane++;
        assign(cid, lane);
      }
    }
  }
  assign(root.id, 0);

  const years = list.map((n) => n.year);
  const yMin = Math.min(...years);
  const yMax = Math.max(...years);
  const yearSpan = Math.max(1, yMax - yMin);
  const maxLane = Math.max(0, ...laneOf.values());
  const padX = 10;
  const padY = 6;
  const usableW = Math.max(20, rect.w - padX * 2);
  const usableH = Math.max(20, rect.h - padY * 2);
  const laneGap = maxLane === 0 ? 0 : Math.min(28, usableW / Math.max(1, maxLane));

  const positions = new Map();
  for (const n of list) {
    const lane = laneOf.get(n.id) ?? 0;
    const t = (n.year - yMin) / yearSpan;
    const px = rect.x + padX + lane * laneGap;
    const py = rect.y + padY + t * usableH;
    positions.set(n.id, { x: px, y: py, node: n, lane });
  }

  const edges = [];
  for (const n of list) {
    if (n.parentId && positions.has(n.parentId) && positions.has(n.id)) {
      edges.push({ from: n.parentId, to: n.id });
    }
  }

  return {
    positions,
    edges,
    orientation: 'vertical-down',
    yMin,
    yMax,
    maxLane,
  };
}
