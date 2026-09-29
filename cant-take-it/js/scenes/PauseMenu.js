/**
 * Esc pause — Portfolio overview, Map (timeline graph + jump/compare), and Charts.
 * Map Compare provides side-by-side portfolio snapshots for two timelines.
 */

import { PALETTE, VIEW_W, CANVAS_H, KEYS } from '../config.js';
import {
  listTimelineNodes,
  jumpToHallwayNode,
  listCompareBranches,
  portfolioAtYearOnBranch,
  layoutTimelineMap,
  buildTimelineMapModel,
  pathFromRoot,
} from '../state/GameState.js';
import { computeWorth } from '../finance/Engine.js';
import { drawWorthChart, BRANCH_COLORS } from '../render/Charts.js';
import { makeDialogChrome } from '../render/Assets.js';
import { formatMoneyDisplay } from '../render/Dialog.js';

const VIEW_TABS = ['portfolio', 'map', 'charts'];

/** Charts remain focused on the current path; timeline comparison lives on Map. */

export class PauseMenu {
  constructor() {
    this.open = false;
    this.screen = 'menu'; // menu | portfolio | map | charts
    this.selected = 0;
    this.portfolioPage = 0; // 0 = summary, 1 = homes and loans
    this.portfolioDetailPage = 0;
    this.hallwayNodes = [];
    this.chrome = null;
    /** Map compare: overview | select | result. */
    this.mapMode = 'overview';
    this.mapCompareActive = 0;
    this.mapCompareA = 0;
    this.mapCompareB = 1;
    /** Calendar year for Map Compare side-by-side portfolio snapshots. */
    this.compareYear = null;
    this._askingYear = false;
    /** @type {import('../render/Dialog.js').Dialog|null} */
    this.dialog = null;
  }

  show(game, dialog = null) {
    this.open = true;
    this.screen = 'menu';
    this.selected = 0;
    this.portfolioPage = 0;
    this.portfolioDetailPage = 0;
    this.dialog = dialog || this.dialog;
    this.compareYear = game?.portfolio?.year ?? this.compareYear;
    this.mapMode = 'overview';
    this.mapCompareActive = 0;
    this.mapCompareA = 0;
    this.mapCompareB = 1;
    this.refresh(game);
  }

  hide() {
    this.open = false;
  }

  refresh(game) {
    this.hallwayNodes = listTimelineNodes(game).filter((n) => n.type === 'hallway');
    this.selected = Math.min(this.selected, Math.max(0, this.hallwayNodes.length - 1));
    const branches = listCompareBranches(game);
    if (branches.length < 2) {
      this.mapMode = 'overview';
      this.mapCompareA = 0;
      this.mapCompareB = 1;
    } else {
      this.mapCompareA = Math.min(this.mapCompareA, branches.length - 1);
      this.mapCompareB = Math.min(this.mapCompareB, branches.length - 1);
      if (this.mapCompareA === this.mapCompareB) {
        this.mapCompareB = this.mapCompareA === 0 ? 1 : 0;
      }
    }
  }

  /**
   * @returns {'close'|null|{jump:string}|undefined}
   */
  handleKey(e, game) {
    if (!this.open) return null;

    if (KEYS.cancel.includes(e.key)) {
      e.preventDefault();
      if (this.screen === 'map' && this.mapMode !== 'overview') {
        this.mapMode = 'overview';
        return undefined;
      }
      if (this.screen !== 'menu') {
        this.screen = 'menu';
        this.selected = 0;
        return undefined;
      }
      this.hide();
      return 'close';
    }

    if (this.screen === 'menu') {
      if (KEYS.up.includes(e.key)) {
        this.selected = (this.selected - 1 + 4) % 4;
        e.preventDefault();
        return undefined;
      }
      if (KEYS.down.includes(e.key)) {
        this.selected = (this.selected + 1) % 4;
        e.preventDefault();
        return undefined;
      }
      if (KEYS.confirm.includes(e.key)) {
        e.preventDefault();
        const choice = ['portfolio', 'map', 'charts', 'resume'][this.selected];
        if (choice === 'resume') {
          this.hide();
          return 'close';
        }
        this.screen = choice;
        this.selected = 0;
        this.portfolioPage = 0;
        this.portfolioDetailPage = 0;
        this.refresh(game);
        return undefined;
      }
      return undefined;
    }

    // Tab / Q keeps the original quick-switch behavior between pause views.
    if (e.key === 'Tab' || e.key === 'q' || e.key === 'Q') {
      const current = VIEW_TABS.indexOf(this.screen);
      this.screen = VIEW_TABS[(current + 1) % VIEW_TABS.length];
      this.selected = 0;
      this.portfolioPage = 0;
      this.portfolioDetailPage = 0;
      e.preventDefault();
      return undefined;
    }

    if (this.screen === 'portfolio') {
      if (this.portfolioPage === 1 && (KEYS.up.includes(e.key) || KEYS.down.includes(e.key))) {
        const pages = this.portfolioDetailPages(game.portfolio).length;
        if (pages > 1) {
          this.portfolioDetailPage =
            (this.portfolioDetailPage + (KEYS.down.includes(e.key) ? 1 : pages - 1)) % pages;
        }
        e.preventDefault();
        return undefined;
      }
      if (KEYS.confirm.includes(e.key)) {
        this.portfolioPage = this.portfolioPage === 0 ? 1 : 0;
        this.portfolioDetailPage = 0;
        e.preventDefault();
        return undefined;
      }
      return undefined;
    }

    if (this.screen === 'map') {
      const branches = listCompareBranches(game);
      if ((e.key === 'c' || e.key === 'C') && branches.length >= 2) {
        this.mapMode = this.mapMode === 'overview' || this.mapMode === 'result' ? 'select' : 'overview';
        this.mapCompareActive = 0;
        e.preventDefault();
        return undefined;
      }

      if (this.mapMode === 'select') {
        if (KEYS.left.includes(e.key) || KEYS.right.includes(e.key)) {
          this.mapCompareActive = KEYS.right.includes(e.key) ? 1 : 0;
          e.preventDefault();
          return undefined;
        }
        if (KEYS.up.includes(e.key) || KEYS.down.includes(e.key)) {
          const dir = KEYS.down.includes(e.key) ? 1 : -1;
          const other = this.mapCompareActive === 0 ? this.mapCompareB : this.mapCompareA;
          let value = this.mapCompareActive === 0 ? this.mapCompareA : this.mapCompareB;
          for (let i = 0; i < branches.length; i += 1) {
            value = (value + dir + branches.length) % branches.length;
            if (value !== other) break;
          }
          if (this.mapCompareActive === 0) this.mapCompareA = value;
          else this.mapCompareB = value;
          e.preventDefault();
          return undefined;
        }
        if (KEYS.confirm.includes(e.key)) {
          e.preventDefault();
          this.promptMapCompareYear(game);
          return undefined;
        }
        return undefined;
      }

      if (this.mapMode === 'result') {
        if (KEYS.confirm.includes(e.key)) {
          e.preventDefault();
          this.promptMapCompareYear(game);
          return undefined;
        }
        return undefined;
      }

      if (KEYS.up.includes(e.key)) {
        if (this.hallwayNodes.length) {
          this.selected =
            (this.selected - 1 + this.hallwayNodes.length) % this.hallwayNodes.length;
        }
        e.preventDefault();
        return undefined;
      }
      if (KEYS.down.includes(e.key)) {
        if (this.hallwayNodes.length) {
          this.selected = (this.selected + 1) % this.hallwayNodes.length;
        }
        e.preventDefault();
        return undefined;
      }
      if (KEYS.confirm.includes(e.key)) {
        e.preventDefault();
        const node = this.hallwayNodes[this.selected];
        if (node) {
          const ok = jumpToHallwayNode(game, node.id);
          if (ok) {
            this.hide();
            return { jump: node.id };
          }
        }
        return undefined;
      }
    }

    if (this.screen === 'charts') {
      // Timeline comparison is deliberately on Map; Charts stays single-path.
      return undefined;
    }

    return undefined;
  }

  /** Start Map Compare's year prompt after two timelines are selected. */
  async promptMapCompareYear(game) {
    if (!this.dialog || this._askingYear) return;
    this._askingYear = true;
    const branches = listCompareBranches(game);
    const defaultYear =
      this.compareYear ?? game.portfolio?.year ?? branches[0]?.yearMax ?? new Date().getFullYear();
    try {
      const year = await this.dialog.prompt('Year to compare across timelines?', {
        title: 'Map Compare',
        defaultValue: String(defaultYear),
        type: 'number',
      });
      if (year != null && year !== '') {
        const y = Math.round(Number(year));
        if (Number.isFinite(y)) {
          this.compareYear = y;
          this.mapMode = 'result';
        }
      }
    } finally {
      this._askingYear = false;
    }
  }


  draw(ctx, game) {
    if (!this.open) return;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, VIEW_W, CANVAS_H);

    const boxW = 300;
    const boxH = 200;
    const x = Math.floor((VIEW_W - boxW) / 2);
    const y = Math.floor((CANVAS_H - boxH) / 2);
    if (!this.chrome || this.chrome.width !== boxW || this.chrome.height !== boxH) {
      this.chrome = makeDialogChrome(boxW, boxH);
    }
    ctx.drawImage(this.chrome, x, y);

    if (this.screen === 'menu') {
      this.drawMenu(ctx, x, y, boxW);
    } else {
      this.drawSubView(ctx, game, x, y, boxW, boxH);
    }
  }

  drawMenu(ctx, x, y, boxW) {
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('Pause', x + 12, y + 10);
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = PALETTE.uiText;
    ctx.fillText('Choose a view', x + 12, y + 31);

    const options = ['Portfolio', 'Map', 'Charts', 'Resume'];
    let oy = y + 55;
    options.forEach((label, i) => {
      const selected = i === this.selected;
      if (selected) {
        ctx.fillStyle = 'rgba(200,160,80,0.25)';
        ctx.fillRect(x + 10, oy - 2, boxW - 20, 18);
        ctx.fillStyle = PALETTE.gold;
      } else {
        ctx.fillStyle = PALETTE.uiText;
      }
      ctx.font = '8px "Press Start 2P", monospace';
      ctx.fillText(`${selected ? '▶' : ' '} ${label}`, x + 16, oy);
      oy += 22;
    });

    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillStyle = '#777';
    ctx.fillText('Enter select · Esc resume', x + 12, y + 178);
  }

  drawSubView(ctx, game, x, y, boxW, boxH) {
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = PALETTE.gold;
    const title =
      this.screen === 'portfolio'
        ? this.portfolioPage === 0
          ? 'Portfolio Overview'
          : 'Portfolio Details'
        : this.screen === 'map'
          ? 'Timeline Map'
          : this.chartTitle(game);
    ctx.fillText(title, x + 12, y + 10);
    ctx.fillStyle = '#666';
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillText('Tab next · Esc back', x + 190, y + 12);

    if (this.screen === 'portfolio') {
      this.drawPortfolio(ctx, game.portfolio, x, y, boxW, boxH);
    } else if (this.screen === 'map') {
      this.drawMap(ctx, game, x, y, boxW, boxH);
    } else {
      this.drawCharts(ctx, game, x, y, boxW, boxH);
    }
  }

  chartTitle(game) {
    return 'Charts · Net worth';
  }

  drawCharts(ctx, game, x, y, boxW, boxH) {
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillStyle = '#888';
    ctx.fillText('Current timeline · Map has Compare', x + 12, y + 28);
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = PALETTE.uiText;
    ctx.fillText('Net worth over years', x + 12, y + 38);
    drawWorthChart(ctx, game.worthHistory || [], {
      x: x + 12,
      y: y + 48,
      w: boxW - 24,
      h: boxH - 72,
      series: ['netWorth', 'bank'],
    });
  }

  drawSnapshotColumn(ctx, branch, snap, year, cx, cy, colW, colH, compact = false) {
    const color =
      BRANCH_COLORS[
        Math.max(0, (branch.letter || 'A').charCodeAt(0) - 65) % BRANCH_COLORS.length
      ];
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(cx, cy, colW, colH);
    ctx.strokeStyle = color;
    ctx.strokeRect(cx + 0.5, cy + 0.5, colW - 1, colH - 1);

    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = color;
    const head = `${branch.letter}${branch.isCurrent ? '*' : ''}`;
    ctx.fillText(head, cx + 4, cy + 4);

    ctx.font = compact ? '4px "Press Start 2P", monospace' : '5px "Press Start 2P", monospace';
    if (snap.status === 'before') {
      ctx.fillStyle = '#888';
      ctx.fillText('Before branch', cx + 4, cy + 18);
      ctx.fillText(`(starts ${snap.yearMin})`, cx + 4, cy + 28);
      return;
    }
    if (snap.status === 'after') {
      ctx.fillStyle = '#888';
      ctx.fillText('After end', cx + 4, cy + 18);
      ctx.fillText(`(ends ${snap.yearMax})`, cx + 4, cy + 28);
      return;
    }
    if (snap.status === 'gap') {
      ctx.fillStyle = '#888';
      ctx.fillText('n/a this year', cx + 4, cy + 18);
      ctx.fillText('(no snapshot)', cx + 4, cy + 28);
      return;
    }
    if (snap.status !== 'ok' || !snap.portfolio || !snap.worth) {
      ctx.fillStyle = '#888';
      ctx.fillText('n/a', cx + 4, cy + 18);
      return;
    }

    const p = snap.portfolio;
    const w = snap.worth;
    const lines = snapshotLines(p, w, snap);
    let ry = cy + (compact ? 14 : 16);
    for (const line of lines) {
      if (ry > cy + colH - (compact ? 5 : 10)) break;
      ctx.fillStyle = line.heading ? PALETTE.gold : PALETTE.uiText;
      ctx.fillText(clip(line.text, colW - 8), cx + 4, ry);
      ry += compact ? 7 : 9;
    }
  }

  drawPortfolio(ctx, p, x, y, boxW, boxH) {
    const worth = computeWorth(p);
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.textBaseline = 'top';
    ctx.fillStyle = PALETTE.uiText;
    const rows =
      this.portfolioPage === 0
        ? this.portfolioSummaryRows(p, worth)
        : this.portfolioDetailPages(p)[this.portfolioDetailPage] || [];
    let ry = y + 32;
    for (const row of rows) {
      ctx.fillStyle = row.heading ? PALETTE.gold : PALETTE.uiText;
      ctx.fillText(row.text, x + 12, ry);
      ry += 9;
    }

    ctx.fillStyle = '#777';
    ctx.font = '5px "Press Start 2P", monospace';
    if (this.portfolioPage === 0) {
      ctx.fillText('Enter details · Tab next · Esc back', x + 12, y + boxH - 14);
    } else {
      const pages = this.portfolioDetailPages(p).length;
      const pageLabel = pages > 1 ? ` · Page ${this.portfolioDetailPage + 1}/${pages}` : '';
      ctx.fillText(`Enter summary · Up/Down page${pageLabel}`, x + 12, y + boxH - 14);
    }
  }

  portfolioSummaryRows(p, worth) {
    const salaryLine = p.retired
      ? `Retired · Spend ${money(p.annualSpending)}/yr`
      : `Salary ${money(p.salary)} · Spend ${money(p.annualSpending)}`;
    const kids = p.kids || [];
    const kidsLine = kids.length
      ? `Kids ${kids.length} · Ages ${kids.map((k) => Number(k.age) || 0).join(', ')}`
      : 'Kids none';
    const loanTotal =
      (p.otherDebt || 0) + (p.otherLoans || []).reduce((sum, l) => sum + (l.principal || 0), 0);
    const savingsRate = p.savingsRate == null ? '' : ` @ ${percent(p.savingsRate)}`;
    return [
      { text: `Year ${p.year} · Age ${p.age}` },
      { text: salaryLine },
      { text: `Cash ${money(worth.cash)}` },
      { text: `Savings ${money(worth.savings)}${savingsRate}` },
      { text: `Stocks ${money(worth.stocks)} · Basis ${money(worth.stocksCostBasis)}` },
      { text: `401(k) ${money(worth.k401Balance)}` },
      { text: `Homes ${(p.homes || []).length} · Equity ${money(worth.homeEquity)}` },
      { text: `Loans ${money(loanTotal)}` },
      { text: kidsLine },
      { text: `Net worth ${money(worth.netWorth)}`, heading: true },
    ];
  }

  portfolioDetailPages(p) {
    const rows = [];
    const homes = p.homes || [];
    const loans = p.otherLoans || [];
    if (homes.length) {
      rows.push({ text: 'Homes', heading: true });
      homes.forEach((home, i) => {
        const label = (home.label || home.type || `Home ${i + 1}`).slice(0, 18);
        rows.push({ text: `${label}: V ${money(home.value)} · M ${money(home.mortgageOwed)}` });
      });
    } else {
      rows.push({ text: 'Homes: none' });
    }
    rows.push({ text: 'Loans', heading: true });
    if (loans.length) {
      loans.forEach((loan) => {
        const type =
          loan.type === 'heloc'
            ? 'HELOC'
            : loan.type === 'securities'
              ? 'Securities loan'
              : (loan.label || 'Other loan').slice(0, 16);
        rows.push({ text: `${type}: ${money(loan.principal)}` });
      });
    } else {
      rows.push({ text: 'No HELOC or securities loans' });
    }
    if ((p.otherDebt || 0) > 0) rows.push({ text: `Other debt: ${money(p.otherDebt)}` });

    const pages = [];
    for (let i = 0; i < rows.length; i += 13) pages.push(rows.slice(i, i + 13));
    return pages.length ? pages : [[{ text: 'No homes or loans.' }]];
  }

  /**
   * Vertical timeline TREE: time ↑, forks ↗ at Decision Room entries.
   * Each Timeline line shows A (start) / B (forks) / C (age 100).
   * Jump list kept for Enter-to-hallway; selected hallway highlighted when on graph year.
   */
  drawMap(ctx, game, x, y, boxW, boxH) {
    const compareSelect = this.mapMode === 'select';
    const compareResult = this.mapMode === 'result';
    const yearLabel = this.compareYear == null ? '' : ` · ${this.compareYear}`;
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillStyle = PALETTE.uiText;
    ctx.fillText(
      compareResult
        ? `Compare${yearLabel} · Enter year · C change`
        : compareSelect
          ? 'Compare · ←/→ side · ↑/↓ timeline · Enter year'
          : 'Time ↑ · DR forks ↗ · C Compare · Enter jump',
      x + 12,
      y + 28
    );

    const graphX = x + 12;
    const graphY = y + 38;
    // Leave room below the graph for Map Compare's two snapshot columns.
    const graphH = compareResult ? 52 : compareSelect ? 76 : 92;
    const graphW = boxW - 24;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = '#444';
    ctx.strokeRect(graphX + 0.5, graphY + 0.5, graphW - 1, graphH - 1);

    const layout = layoutTimelineMap(game, {
      x: graphX + 10,
      y: graphY + 8,
      w: graphW - 20,
      h: graphH - 16,
    });
    const model = layout.model || buildTimelineMapModel(game);
    const selected = this.hallwayNodes[this.selected];

    // Spine + fork connectors
    for (const seg of layout.segments || []) {
      ctx.beginPath();
      if (seg.kind === 'spine') {
        ctx.strokeStyle = seg.isCurrent ? '#c8a050' : '#555';
        ctx.lineWidth = seg.isCurrent ? 2 : 1;
      } else {
        ctx.strokeStyle = '#887848';
        ctx.lineWidth = 1;
      }
      ctx.moveTo(seg.x1, seg.y1);
      ctx.lineTo(seg.x2, seg.y2);
      ctx.stroke();
    }

    // Timeline number labels at each spine start
    ctx.font = '5px "Press Start 2P", monospace';
    for (const tl of model.timelines || []) {
      const aPt = (layout.points || []).find(
        (p) => p.timeline === tl.number && p.kind === 'A'
      );
      if (!aPt) continue;
      ctx.fillStyle = tl.isCurrent ? PALETTE.gold : '#888';
      ctx.fillText(String(tl.number), aPt.x - 8, aPt.y + 3);
    }

    // A / B / C points
    for (const pt of layout.points || []) {
      const r = pt.kind === 'C' ? 3.5 : 3;
      if (pt.kind === 'A') ctx.fillStyle = PALETTE.gold;
      else if (pt.kind === 'B') ctx.fillStyle = '#80c0e0';
      else ctx.fillStyle = '#c04040';
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#aaa';
      ctx.font = '4px "Press Start 2P", monospace';
      const tag = pt.kind === 'B' ? pt.label : pt.kind;
      ctx.fillText(tag, pt.x + 5, pt.y + 2);
      if (pt.kind === 'A' || pt.kind === 'C') {
        ctx.fillStyle = '#666';
        ctx.fillText(String(pt.year), pt.x + 5, pt.y + 9);
      }
    }

    if (!compareResult && layout.currentPos) {
      const cp = layout.currentPos;
      ctx.strokeStyle = '#fff';
      ctx.lineWidth = 1;
      ctx.strokeRect(cp.x - 5, cp.y - 5, 10, 10);
      ctx.fillStyle = '#fff';
      ctx.font = '4px "Press Start 2P", monospace';
      ctx.fillText('you', cp.x + 6, cp.y - 4);
    }

    // Selected jump-target year marker (hallway)
    if (!compareSelect && !compareResult && selected && layout.xy) {
      let markLane =
        (model.timelines.find((t) => t.isCurrent) || model.timelines[0] || {})
          .lane ?? 0;
      for (const tl of model.timelines || []) {
        const path = pathFromRoot(game, tl.tipId);
        if (path.some((n) => n.id === selected.id)) {
          markLane = tl.lane;
          break;
        }
      }
      const sp = layout.xy(markLane, selected.year);
      ctx.strokeStyle = PALETTE.gold;
      ctx.strokeRect(sp.x - 6, sp.y - 6, 12, 12);
    }

    ctx.fillStyle = '#666';
    ctx.font = '4px "Press Start 2P", monospace';
    ctx.fillText('A start  B DR-fork  C age100', x + 12, graphY + graphH + 2);

    if (compareSelect) {
      const branches = listCompareBranches(game);
      let ly = graphY + graphH + 13;
      ctx.font = '5px "Press Start 2P", monospace';
      [this.mapCompareA, this.mapCompareB].forEach((branchIndex, side) => {
        const branch = branches[branchIndex];
        const timeline = (model.timelines || []).find((t) => t.tipId === branch?.tipId);
        const active = this.mapCompareActive === side;
        ctx.fillStyle = active ? PALETTE.gold : PALETTE.uiText;
        ctx.fillText(
          `${active ? '▶' : ' '} ${side === 0 ? 'A' : 'B'}: Timeline ${timeline?.number ?? branchIndex + 1}${
            branch?.isCurrent ? '*' : ''
          }`,
          x + 12,
          ly
        );
        ly += 11;
      });
      return;
    }

    if (compareResult) {
      const branches = listCompareBranches(game);
      const pair = [branches[this.mapCompareA], branches[this.mapCompareB]].filter(Boolean);
      const snapshotY = graphY + graphH + 14;
      const colW = Math.floor((boxW - 28) / 2);
      pair.forEach((branch, i) => {
        const cx = x + 12 + i * (colW + 4);
        const snap = portfolioAtYearOnBranch(game, branch.tipId, this.compareYear);
        this.drawSnapshotColumn(ctx, branch, snap, this.compareYear, cx, snapshotY, colW, y + boxH - snapshotY - 6, true);
      });
      return;
    }

    let ly = graphY + graphH + 12;
    ctx.font = '6px "Press Start 2P", monospace';
    if (!this.hallwayNodes.length) {
      ctx.fillStyle = '#888';
      ctx.fillText('No hallway nodes yet.', x + 12, ly);
      return;
    }
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('Jump to Hallway:', x + 12, ly);
    ly += 11;
    const start = Math.max(0, this.selected - 1);
    const visible = this.hallwayNodes.slice(start, start + 3);
    visible.forEach((n, vi) => {
      const idx = start + vi;
      const sel = idx === this.selected;
      ctx.fillStyle = sel ? 'rgba(200,160,80,0.25)' : 'transparent';
      ctx.fillRect(x + 10, ly - 1, boxW - 20, 11);
      ctx.fillStyle = sel ? PALETTE.gold : PALETTE.uiText;
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillText(
        `${sel ? '▶' : ' '} ${n.label || `Hallway ${n.year}`} (age ${n.age})`,
        x + 12,
        ly
      );
      ly += 11;
    });
  }
}

function snapshotLines(p, worth, snap) {
  const age = snap.age ?? p.age;
  const yearLabel = `Y${p.year ?? snap.year} · Age ${age}`;
  const salaryLine = p.retired
    ? 'Retired'
    : `Salary ${money(p.salary)}`;
  const loanTotal =
    (p.otherDebt || 0) + (p.otherLoans || []).reduce((sum, l) => sum + (l.principal || 0), 0);
  const homeN = (p.homes || []).length;
  return [
    { text: yearLabel },
    { text: salaryLine },
    { text: `Cash ${money(worth.cash ?? worth.bank)}` },
    { text: `Save ${money(worth.savings)}` },
    { text: `Stk ${money(worth.stocks)}` },
    { text: `401k ${money(worth.k401Balance)}` },
    { text: `Home×${homeN} Eq ${money(worth.homeEquity)}` },
    { text: `Loans ${money(loanTotal)}` },
    { text: `Net ${money(worth.netWorth)}`, heading: true },
  ];
}

function clip(text, maxPx) {
  // Press Start 2P ~5px/char at 5px font — rough fit for column width
  const maxChars = Math.max(6, Math.floor(maxPx / 5));
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars - 1) + '…';
}

function money(value) {
  return formatMoneyDisplay(value);
}

function percent(value) {
  const n = Number(value);
  if (!Number.isFinite(n)) return '—';
  return `${+(n * 100).toFixed(2)}%`;
}
