/**
 * Esc pause — Map (timeline graph + jump) and Charts tabs.
 */

import { PALETTE, VIEW_W, VIEW_H, KEYS } from '../config.js';
import { listTimelineNodes, jumpToHallwayNode } from '../state/GameState.js';
import { drawWorthChart } from '../render/Charts.js';
import { makeDialogChrome } from '../render/Assets.js';

export class PauseMenu {
  constructor() {
    this.open = false;
    this.tab = 'map'; // map | charts
    this.selected = 0;
    this.hallwayNodes = [];
    this.chrome = null;
  }

  show(game) {
    this.open = true;
    this.tab = 'map';
    this.refresh(game);
  }

  hide() {
    this.open = false;
  }

  refresh(game) {
    this.hallwayNodes = listTimelineNodes(game).filter((n) => n.type === 'hallway');
    this.selected = Math.min(this.selected, Math.max(0, this.hallwayNodes.length - 1));
  }

  /**
   * @returns {'close'|null|{jump:string}|undefined}
   */
  handleKey(e, game) {
    if (!this.open) return null;

    if (KEYS.cancel.includes(e.key)) {
      e.preventDefault();
      this.hide();
      return 'close';
    }

    if (e.key === 'Tab' || e.key === 'q' || e.key === 'Q') {
      this.tab = this.tab === 'map' ? 'charts' : 'map';
      e.preventDefault();
      return undefined;
    }

    if (this.tab === 'map') {
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

    return undefined;
  }

  draw(ctx, game) {
    if (!this.open) return;

    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    const boxW = 300;
    const boxH = 200;
    const x = Math.floor((VIEW_W - boxW) / 2);
    const y = Math.floor((VIEW_H - boxH) / 2);
    if (!this.chrome || this.chrome.width !== boxW || this.chrome.height !== boxH) {
      this.chrome = makeDialogChrome(boxW, boxH);
    }
    ctx.drawImage(this.chrome, x, y);

    // Tabs
    ctx.font = '8px "Press Start 2P", monospace';
    ctx.textBaseline = 'top';
    const tabs = [
      { id: 'map', label: 'Map' },
      { id: 'charts', label: 'Charts' },
    ];
    let tx = x + 12;
    for (const t of tabs) {
      const active = this.tab === t.id;
      ctx.fillStyle = active ? PALETTE.gold : '#666';
      ctx.fillText(active ? `▶${t.label}` : ` ${t.label}`, tx, y + 10);
      tx += 70;
    }
    ctx.fillStyle = '#555';
    ctx.font = '5px "Press Start 2P", monospace';
    ctx.fillText('Tab switch · Esc close', x + 160, y + 12);

    if (this.tab === 'map') {
      this.drawMap(ctx, game, x, y, boxW, boxH);
    } else {
      ctx.font = '7px "Press Start 2P", monospace';
      ctx.fillStyle = PALETTE.uiText;
      ctx.fillText('Net worth over years', x + 12, y + 28);
      drawWorthChart(ctx, game.worthHistory || [], {
        x: x + 12,
        y: y + 40,
        w: boxW - 24,
        h: boxH - 60,
        series: ['netWorth', 'bank'],
      });
    }
  }

  drawMap(ctx, game, x, y, boxW, boxH) {
    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = PALETTE.uiText;
    ctx.fillText('Timeline — select Hallway to jump back', x + 12, y + 28);

    const nodes = listTimelineNodes(game);
    // Schematic: draw room/hallway nodes as connected dots
    const graphY = y + 48;
    const graphH = 50;
    const usable = nodes.slice(-12);
    if (usable.length) {
      const gap = Math.min(22, (boxW - 40) / Math.max(1, usable.length));
      usable.forEach((n, i) => {
        const nx = x + 16 + i * gap;
        const ny = graphY + (n.type === 'hallway' ? 8 : 28);
        ctx.fillStyle = n.type === 'hallway' ? '#80c0e0' : PALETTE.gold;
        ctx.fillRect(nx, ny, 6, 6);
        if (i > 0) {
          const prev = usable[i - 1];
          const px = x + 16 + (i - 1) * gap + 3;
          const py = graphY + (prev.type === 'hallway' ? 11 : 31);
          ctx.strokeStyle = '#555';
          ctx.beginPath();
          ctx.moveTo(px, py);
          ctx.lineTo(nx + 3, ny + 3);
          ctx.stroke();
        }
      });
      ctx.fillStyle = '#666';
      ctx.font = '5px "Press Start 2P", monospace';
      ctx.fillText('◆ room   ● hallway', x + 12, graphY + graphH - 4);
    }

    // Hallway jump list
    let ly = y + 110;
    ctx.font = '6px "Press Start 2P", monospace';
    if (!this.hallwayNodes.length) {
      ctx.fillStyle = '#888';
      ctx.fillText('No hallway nodes yet.', x + 12, ly);
      return;
    }
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText('Jump to Hallway:', x + 12, ly);
    ly += 12;
    const start = Math.max(0, this.selected - 2);
    const visible = this.hallwayNodes.slice(start, start + 4);
    visible.forEach((n, vi) => {
      const idx = start + vi;
      const sel = idx === this.selected;
      ctx.fillStyle = sel ? 'rgba(200,160,80,0.25)' : 'transparent';
      ctx.fillRect(x + 10, ly - 1, boxW - 20, 12);
      ctx.fillStyle = sel ? PALETTE.gold : PALETTE.uiText;
      ctx.fillText(
        `${sel ? '▶' : ' '} ${n.label || `Hallway ${n.year}`} (age ${n.age})`,
        x + 12,
        ly
      );
      ly += 12;
    });
  }
}
