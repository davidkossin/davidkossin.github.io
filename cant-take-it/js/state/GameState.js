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
 * Tuned "average US household" starter for New Game → Standard portfolio.
 *
 * Rough mid-2020s grounding (order-of-magnitude, not a Census extract):
 *   age 40, married, one school-age child; ~$78k household gross;
 *   primary home ~$380k with ~$270k @ 6.5% / 27yr left; liquid buffers
 *   (Cash / savings / taxable stocks) and a modest 401(k); ZIP 85001 (AZ).
 *
 * Glass-wall validation (Standard difficulty, deterministic projectYears,
 * no Decision Room changes — same path as HallwayScene):
 *   snapshots = [baseline, ...projectYears(baseline, years, 'standard', {deterministic:true})]
 *   findBankInsolvencyIndex(snapshots) === 6  (±1 ok)
 *   → Cash ≤ 0 after ~6 projected years / ~6 hallway doors (year index 6).
 * Tuned primarily via annualSpending vs salary / tax / 401(k) deferral / mortgage P&I
 * (+ USDA child-cost band). Re-check if Engine cashflow or difficulty presets change.
 */
export function createStandardPortfolioSetup() {
  const home = {
    type: 'primary',
    label: 'Primary Residence',
    value: 380000,
    mortgageOwed: 270000,
    rate: 0.065,
    remainingTerm: 27,
    propertyTaxRate: 0.012,
  };
  const spend = 35000;
  return {
    playerName: 'Alex',
    year: CURRENT_YEAR,
    age: 40,
    hairColor: 'dark',
    hairLength: 'short',
    cash: 5500,
    salary: 78000,
    savings: 15000,
    savingsRate: 0.02,
    homes: [home],
    stocksTotal: 22000,
    stocksCostBasis: 18700,
    k401Balance: 62000,
    k401ContribRate: 0.06,
    k401MatchRate: 1.0,
    k401MatchOnFirst: 0.03,
    married: true,
    kids: [{ name: 'Sam', age: 7 }],
    annualSpending: spend,
    spendingBreakdown: {
      incomeTax: 0,
      mortgage: 0,
      propertyTax: 0,
      other: spend,
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
 * If the current node already has children, this Decision Room entry is a fork
 * (spawned timeline); otherwise it continues the current timeline.
 */
export function enterYearRoom(game, projectedPortfolio) {
  const p = cloneState(projectedPortfolio);
  game.portfolio = p;
  const parentId = game.timeline.currentNodeId;
  const parentKids = Object.values(game.timeline.nodes || {}).filter(
    (n) => n.parentId === parentId
  );
  const isFork = parentKids.length > 0;
  const id = nextBranchId(game, 'room-begin', p.year);
  const snapshotId = `snap-${id}`;
  game.timeline.snapshots[snapshotId] = cloneState(p);
  game.timeline.nodes[id] = {
    id,
    year: p.year,
    age: p.age,
    type: 'room',
    kind: 'begin',
    parentId,
    snapshotId,
    label: `Decision Room ${p.year}`,
    /** True when this entry splits a new timeline off an already-explored parent */
    isFork,
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
 * True when this Decision Room begin splits a new timeline off a parent
 * that already had at least one child (spawn-off / Map jump then re-enter).
 * Hallway year doors alone do not count — only Decision Room entries.
 * @param {object} node
 * @param {Map<string, string[]>} kids
 */
export function isDecisionRoomForkEntry(node, kids) {
  if (!node || node.type !== 'room') return false;
  if (node.kind && node.kind !== 'begin') return false;
  if (node.isFork) return true;
  if (!node.parentId) return false;
  const siblings = kids.get(node.parentId) || [];
  if (siblings.length < 2) return false;
  // First child continues the parent timeline; later Decision Room entries fork
  return siblings[0] !== node.id;
}

/**
 * Semantic timeline TREE for the pause Map.
 * Each leaf tip is a Timeline (1, 2, 3…); forks spawn when entering a Decision Room
 * from a parent that already has descendants.
 *
 * Point A = branch start year (game start on Timeline 1; Decision Room year on forks)
 * Point B / B2… = further Decision Room fork years along that timeline
 * Point C = age-100 / terminal year end marker
 *
 * @param {object} game
 * @returns {{
 *   timelines: Array<object>,
 *   connectors: Array<object>,
 *   startYear: number,
 *   terminalYear: number,
 *   current: object|null,
 *   laneCount: number,
 * }}
 */
export function buildTimelineMapModel(game) {
  const nodes = game.timeline?.nodes || {};
  const list = Object.values(nodes);
  if (!list.length) {
    return {
      timelines: [],
      connectors: [],
      startYear: 0,
      terminalYear: 0,
      current: null,
      laneCount: 0,
    };
  }

  const kids = timelineChildrenMap(game);
  const root = list.find((n) => !n.parentId) || list[0];
  const startYear = game.timeline.startYear ?? root.year;
  const startAge = game.timeline.startAge ?? root.age;
  const terminalYear = startYear + (MAX_AGE - startAge);

  const currentId = game.timeline.currentNodeId;

  // Timeline 1 = root / first Decision Room child at each hub (not current-path).
  // Fork entries (isFork / later siblings) spawn lanes to the right.
  const laneOf = new Map();
  let nextLane = 1;
  function assign(id, preferredLane) {
    if (laneOf.has(id)) return;
    laneOf.set(id, preferredLane);
    const children = kids.get(id) || [];
    const ordered = [...children].sort((a, b) => {
      const na = nodes[a];
      const nb = nodes[b];
      const af = isDecisionRoomForkEntry(na, kids) ? 1 : 0;
      const bf = isDecisionRoomForkEntry(nb, kids) ? 1 : 0;
      if (af !== bf) return af - bf;
      if ((na?.year ?? 0) !== (nb?.year ?? 0)) return (na?.year ?? 0) - (nb?.year ?? 0);
      return String(a).localeCompare(String(b));
    });
    ordered.forEach((cid, i) => {
      if (i === 0) assign(cid, preferredLane);
      else assign(cid, nextLane++);
    });
  }
  assign(root.id, 0);

  const tips = listBranchTips(game);
  const timelines = tips.map((tip) => {
    const path = pathFromRoot(game, tip.id);
    const lane = laneOf.get(tip.id) ?? 0;

    // Point A: game start on root spine; Decision Room year where this lane spawned
    let yearA = startYear;
    let spawnNode = null;
    for (let i = 1; i < path.length; i++) {
      const n = path[i];
      const parent = path[i - 1];
      if ((laneOf.get(n.id) ?? 0) !== (laneOf.get(parent.id) ?? 0)) {
        spawnNode = n;
        break;
      }
    }
    if (spawnNode) yearA = spawnNode.year;

    // Point B…: Decision Room entries that forked RIGHT off hubs on this lane
    const forks = [];
    let forkIdx = 0;
    for (const n of path) {
      if ((laneOf.get(n.id) ?? 0) !== lane) continue;
      const children = kids.get(n.id) || [];
      if (children.length < 2) continue;
      for (const cid of children) {
        const child = nodes[cid];
        if (!child) continue;
        const childLane = laneOf.get(cid) ?? 0;
        if (childLane === lane) continue;
        // Only count Decision Room entries as fork tips (not room-end / hallway noise)
        if (child.type !== 'room' || (child.kind && child.kind !== 'begin')) continue;
        forkIdx += 1;
        forks.push({
          year: child.year,
          label: forkIdx === 1 ? 'B' : `B${forkIdx}`,
          hubId: n.id,
          childId: cid,
          childLane,
        });
      }
    }

    return {
      number: 0,
      lane,
      tipId: tip.id,
      tip,
      yearA,
      yearC: terminalYear,
      forks,
      isCurrent: path.some((n) => n.id === currentId),
      spawnNodeId: spawnNode?.id ?? null,
    };
  });

  timelines.sort((a, b) => a.lane - b.lane || a.yearA - b.yearA);
  timelines.forEach((t, i) => {
    t.number = i + 1;
  });

  const connectors = [];
  for (const t of timelines) {
    for (const f of t.forks) {
      connectors.push({
        fromLane: t.lane,
        toLane: f.childLane,
        year: f.year,
        label: f.label,
      });
    }
  }

  const cur = currentId ? nodes[currentId] : null;
  return {
    timelines,
    connectors,
    startYear,
    terminalYear,
    current: cur
      ? {
          year: cur.year,
          age: cur.age,
          id: cur.id,
          lane: laneOf.get(currentId) ?? 0,
          type: cur.type,
        }
      : null,
    laneCount: Math.max(1, nextLane),
  };
}

/**
 * Layout positions for pause Timeline Map (A/B/C tree).
 * Time flows UP; forks spawn RIGHT as Y-shaped up-right branches.
 *
 * @param {object} game
 * @param {{x:number,y:number,w:number,h:number}} rect
 * @returns {object}
 */
export function layoutTimelineMap(game, rect) {
  const model = buildTimelineMapModel(game);
  const padX = 14;
  const padY = 8;
  const usableW = Math.max(20, rect.w - padX * 2);
  const usableH = Math.max(20, rect.h - padY * 2);
  const yMin = model.startYear;
  const yMax = model.terminalYear;
  const yearSpan = Math.max(1, yMax - yMin);
  const maxLane = Math.max(0, ...(model.timelines.map((t) => t.lane) || [0]));
  const laneGap =
    maxLane === 0 ? 0 : Math.min(36, usableW / Math.max(1, maxLane));

  function xy(lane, year) {
    const t = (year - yMin) / yearSpan;
    return {
      x: rect.x + padX + lane * laneGap,
      // Past/start sits at the bottom; future/age 100 rises to the top.
      y: rect.y + padY + (1 - t) * usableH,
    };
  }

  /** @type {Array<{key:string,x:number,y:number,lane:number,year:number,kind:string,label:string,timeline:number,tipId?:string}>} */
  const points = [];
  /** @type {Array<{x1:number,y1:number,x2:number,y2:number,kind:string}>} */
  const segments = [];

  for (const tl of model.timelines) {
    const a = xy(tl.lane, tl.yearA);
    const c = xy(tl.lane, tl.yearC);
    segments.push({
      x1: a.x,
      y1: a.y,
      x2: c.x,
      y2: c.y,
      kind: 'spine',
      timeline: tl.number,
      isCurrent: tl.isCurrent,
    });
    points.push({
      key: `T${tl.number}-A`,
      x: a.x,
      y: a.y,
      lane: tl.lane,
      year: tl.yearA,
      kind: 'A',
      label: 'A',
      timeline: tl.number,
      tipId: tl.tipId,
    });
    for (const f of tl.forks) {
      const bp = xy(tl.lane, f.year);
      points.push({
        key: `T${tl.number}-${f.label}`,
        x: bp.x,
        y: bp.y,
        lane: tl.lane,
        year: f.year,
        kind: 'B',
        label: f.label,
        timeline: tl.number,
        tipId: tl.tipId,
      });
    }
    points.push({
      key: `T${tl.number}-C`,
      x: c.x,
      y: c.y,
      lane: tl.lane,
      year: tl.yearC,
      kind: 'C',
      label: 'C',
      timeline: tl.number,
      tipId: tl.tipId,
    });
  }

  for (const conn of model.connectors) {
    const from = xy(conn.fromLane, conn.year);
    const childAtFork = xy(conn.toLane, conn.year);
    // Join the child spine a little above the fork year so the connector
    // reads as a Y: parent spine continues up, child arm rises up-right.
    const forkRise = Math.min(
      12,
      usableH * 0.12,
      Math.max(0, childAtFork.y - (rect.y + padY))
    );
    segments.push({
      x1: from.x,
      y1: from.y,
      x2: childAtFork.x,
      y2: childAtFork.y - forkRise,
      kind: 'fork',
      label: conn.label,
    });
  }

  let currentPos = null;
  if (model.current) {
    const p = xy(model.current.lane, model.current.year);
    currentPos = { ...p, ...model.current };
  }

  // Legacy-compatible maps for any old callers
  const positions = new Map();
  for (const pt of points) {
    positions.set(pt.key, { x: pt.x, y: pt.y, node: pt, lane: pt.lane });
  }

  return {
    model,
    points,
    segments,
    currentPos,
    positions,
    edges: segments
      .filter((s) => s.kind === 'fork')
      .map((s, i) => ({ from: `fork-${i}-a`, to: `fork-${i}-b` })),
    orientation: 'vertical-up',
    yMin,
    yMax,
    maxLane,
    xy,
  };
}
