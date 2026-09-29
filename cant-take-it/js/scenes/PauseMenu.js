/**
 * Esc pause — Portfolio overview, Map (timeline graph + jump), and Charts.
 * Charts: current path, multi-timeline overlay, and year-entry side-by-side snapshots.
 */

import { PALETTE, VIEW_W, CANVAS_H, KEYS } from '../config.js';
import {
  listTimelineNodes,
  jumpToHallwayNode,
  listCompareBranches,
  portfolioAtYearOnBranch,
  layoutTimelineMap,
} from '../state/GameState.js';
import { computeWorth } from '../finance/Engine.js';
import { drawWorthChart, drawCompareChart, BRANCH_COLORS } from '../render/Charts.js';
import { makeDialogChrome } from '../render/Assets.js';
import { formatMoneyDisplay } from '../render/Dialog.js';

const VIEW_TABS = ['portfolio', 'map', 'charts'];

/** Chart sub-modes when 2+ branches exist */
const CHART_MODES_BRANCHED = ['compare-net', 'compare-cash', 'year', 'current'];
/** Chart sub-modes with a single timeline */
const CHART_MODES_SINGLE = ['current', 'year'];

export class PauseMenu {
  constructor() {
    this.open = false;
    this.screen = 'menu'; // menu | portfolio | map | charts
    this.selected = 0;
    this.portfolioPage = 0; // 0 = summary, 1 = homes and loans
    this.portfolioDetailPage = 0;
    this.hallwayNodes = [];
    this.chrome = null;
    /** @type {'compare-net'|'compare-cash'|'year'|'current'} */
    this.chartMode = 'current';
    /** Calendar year for side-by-side portfolio compare */
    this.compareYear = null;
    /** Index into compare-branch list when picking which two to show side-by-side */
    this.snapshotBranchOffset = 0;
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
    this.snapshotBranchOffset = 0;
    this.refresh(game);
    const branches = listCompareBranches(game);
    this.chartMode = branches.length >= 2 ? 'compare-net' : 'current';
  }

  hide() {
    this.open = false;
  }

  refresh(game) {
    this.hallwayNodes = listTimelineNodes(game).filter((n) => n.type === 'hallway');
    this.selected = Math.min(this.selected, Math.max(0, this.hallwayNodes.length - 1));
  }

  chartModes(game) {
    const branches = listCompareBranches(game);
    return branches.length >= 2 ? CHART_MODES_BRANCHED : CHART_MODES_SINGLE;
  }

  /**
   * @returns {'close'|null|{jump:string}|undefined}
   */
  handleKey(e, game) {
    if (!this.open) return null;

    if (KEYS.cancel.includes(e.key)) {
      e.preventDefault();
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
        if (choice === 'charts') {
          const branches = listCompareBranches(game);
          this.chartMode = branches.length >= 2 ? 'compare-net' : 'current';
        }
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
      const modes = this.chartModes(game);
      if (KEYS.left.includes(e.key) || KEYS.right.includes(e.key)) {
        const dir = KEYS.right.includes(e.key) ? 1 : -1;
        let idx = modes.indexOf(this.chartMode);
        if (idx < 0) idx = 0;
        this.chartMode = modes[(idx + dir + modes.length) % modes.length];
        e.preventDefault();
        return undefined;
      }
      if (KEYS.up.includes(e.key) || KEYS.down.includes(e.key)) {
        // Cycle which pair of branches is shown in year snapshot (A|B, B|C, …)
        const branches = listCompareBranches(game);
        if (branches.length >= 2 && this.chartMode === 'year') {
          const maxOff = Math.max(0, branches.length - 2);
          const dir = KEYS.down.includes(e.key) ? 1 : -1;
          this.snapshotBranchOffset =
            (this.snapshotBranchOffset + dir + maxOff + 1) % (maxOff + 1);
        }
        e.preventDefault();
        return undefined;
      }
      if (KEYS.confirm.includes(e.key)) {
        e.preventDefault();
        // Enter year for side-by-side portfolio compare
        this.chartMode = 'year';
        this.promptCompareYear(game);
        return undefined;
      }
    }

    return undefined;
  }

  /**
   * Dialog.prompt for calendar year — mobile HTML input works via Dialog.
   */
  async promptCompareYear(game) {
    if (!this.dialog || this._askingYear) return;
    this._askingYear = true;
    const branches = listCompareBranches(game);
    const defaultYear =
      this.compareYear ??
      game.portfolio?.year ??
      branches[0]?.yearMax ??
      new Date().getFullYear();
    try {
      const year = await this.dialog.prompt(
        branches.length >= 2
          ? 'Year to compare across timelines?'
          : 'Year for portfolio snapshot?',
        {
          title: 'Year Snapshot',
          defaultValue: String(defaultYear),
          type: 'number',
        }
      );
      if (year != null && year !== '') {
        const y = Math.round(Number(year));
        if (Number.isFinite(y)) {
          this.compareYear = y;
          this.chartMode = 'year';
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
    switch (this.chartMode) {
      case 'compare-net':
        return 'Compare · Net';
      case 'compare-cash':
        return 'Compare · Cash';
      case 'year':
        return this.compareYear != null ? `Year ${this.compareYear}` : 'Year Snapshot';
      default:
        return 'Charts';
    }
  }

  drawCharts(ctx, game, x, y, boxW, boxH) {
    const branches = listCompareBranches(game);
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillStyle = '#888';
    const hint =
      this.chartMode === 'year'
        ? 'Enter year · ←/→ mode · ↑/↓ pair'
        : branches.length >= 2
          ? '←/→ mode · Enter year snap'
          : 'Enter year snap · ←/→ mode';
    ctx.fillText(hint, x + 12, y + 28);

    if (this.chartMode === 'year') {
      this.drawYearSnapshot(ctx, game, branches, x, y, boxW, boxH);
      return;
    }

    if (this.chartMode === 'compare-net' || this.chartMode === 'compare-cash') {
      if (branches.length < 2) {
        this.chartMode = 'current';
      } else {
        const metric = this.chartMode === 'compare-cash' ? 'bank' : 'netWorth';
        ctx.font = '6px "Press Start 2P", monospace';
        ctx.fillStyle = PALETTE.uiText;
        ctx.fillText(
          metric === 'bank' ? 'Cash by timeline' : 'Net worth by timeline',
          x + 12,
          y + 38
        );
        drawCompareChart(ctx, branches, {
          x: x + 12,
          y: y + 48,
          w: boxW - 24,
          h: boxH - 72,
          metric,
        });
        return;
      }
    }

    // current path
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

  /**
   * Side-by-side portfolio columns for compareYear on two timelines.
   */
  drawYearSnapshot(ctx, game, branches, x, y, boxW, boxH) {
    const year = this.compareYear ?? game.portfolio?.year;
    if (year == null) {
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = PALETTE.uiText;
      ctx.fillText('Press Enter to pick a year', x + 12, y + 50);
      return;
    }

    const pair =
      branches.length >= 2
        ? branches.slice(this.snapshotBranchOffset, this.snapshotBranchOffset + 2)
        : branches.length === 1
          ? [branches[0]]
          : [];

    if (!pair.length) {
      // No tips yet — use live portfolio if year matches
      ctx.font = '6px "Press Start 2P", monospace';
      ctx.fillStyle = '#888';
      ctx.fillText('No timeline branches yet.', x + 12, y + 50);
      return;
    }

    const colW = pair.length === 1 ? boxW - 24 : Math.floor((boxW - 28) / 2);
    pair.forEach((b, i) => {
      const cx = x + 12 + i * (colW + 4);
      const snap = portfolioAtYearOnBranch(game, b.tipId, year);
      this.drawSnapshotColumn(ctx, b, snap, year, cx, y + 38, colW, boxH - 52);
    });
  }

  drawSnapshotColumn(ctx, branch, snap, year, cx, cy, colW, colH) {
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

    ctx.font = '5px "Press Start 2P", monospace';
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
    let ry = cy + 16;
    for (const line of lines) {
      if (ry > cy + colH - 10) break;
      ctx.fillStyle = line.heading ? PALETTE.gold : PALETTE.uiText;
      ctx.fillText(clip(line.text, colW - 8), cx + 4, ry);
      ry += 9;
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
   * Vertical timeline map: time flows DOWN (past → future); forks spawn RIGHT.
   * Jump list kept for Enter-to-hallway; selected node highlighted on the graph.
   */
  drawMap(ctx, game, x, y, boxW, boxH) {
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillStyle = PALETTE.uiText;
    // Orientation: past at top, future at bottom; branches fork to the right of the spine.
    ctx.fillText('Time ↓ · forks → · Enter jump', x + 12, y + 28);

    const graphX = x + 12;
    const graphY = y + 40;
    const graphW = boxW - 24;
    const graphH = 88;
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(graphX, graphY, graphW, graphH);
    ctx.strokeStyle = '#444';
    ctx.strokeRect(graphX + 0.5, graphY + 0.5, graphW - 1, graphH - 1);

    const layout = layoutTimelineMap(game, {
      x: graphX + 8,
      y: graphY + 6,
      w: graphW - 16,
      h: graphH - 14,
    });
    const selected = this.hallwayNodes[this.selected];

    // edges — orthogonal-ish: vertical spine then right to fork
    ctx.strokeStyle = '#555';
    ctx.lineWidth = 1;
    for (const e of layout.edges) {
      const a = layout.positions.get(e.from);
      const b = layout.positions.get(e.to);
      if (!a || !b) continue;
      ctx.beginPath();
      ctx.moveTo(a.x + 3, a.y + 3);
      if (a.x === b.x) {
        ctx.lineTo(b.x + 3, b.y + 3);
      } else {
        // down along parent lane, then right/left to child
        const midY = b.y + 3;
        ctx.lineTo(a.x + 3, midY);
        ctx.lineTo(b.x + 3, midY);
      }
      ctx.stroke();
    }

    for (const [, pos] of layout.positions) {
      const n = pos.node;
      const isHall = n.type === 'hallway';
      const isSel = selected && selected.id === n.id;
      const isCur = n.id === game.timeline.currentNodeId;
      ctx.fillStyle = isHall ? '#80c0e0' : PALETTE.gold;
      ctx.fillRect(pos.x, pos.y, 6, 6);
      if (isCur) {
        ctx.strokeStyle = '#fff';
        ctx.strokeRect(pos.x - 1.5, pos.y - 1.5, 9, 9);
      }
      if (isSel) {
        ctx.strokeStyle = PALETTE.gold;
        ctx.strokeRect(pos.x - 2.5, pos.y - 2.5, 11, 11);
      }
    }

    ctx.fillStyle = '#666';
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillText('◆ room  ● hall  □ you', x + 12, graphY + graphH + 2);

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
