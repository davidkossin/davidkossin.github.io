import { PALETTE, VIEW_W, VIEW_H } from '../config.js';
import { hasSaves, listSaves, loadSave } from '../state/SaveSystem.js';
import { makeTile } from '../render/Assets.js';

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.blink = 0;
  }

  async enter() {
    // idle until menu choice via dialog from main
  }

  async runMenu(dialog) {
    const opts = [{ label: 'New Game', value: 'new' }];
    if (hasSaves()) opts.push({ label: 'Load Game', value: 'load' });
    opts.push({ label: 'How to Play', value: 'help' });

    while (true) {
      const choice = await dialog.menu(
        'A life of choices.\nYou can\'t take it with you.',
        opts,
        { title: "You Can't Take It With You" }
      );

      if (choice === 'new') return { action: 'new' };
      if (choice === 'help') {
        await dialog.show(
          'WASD / Arrows move. Enter / Z / E talk. Escape backs out. Walk the Hallway of Time to age forward. Bank windows change your portfolio. Auto-saves when you enter rooms.',
          { title: 'How to Play' }
        );
        continue;
      }
      if (choice === 'load') {
        const saves = listSaves();
        if (!saves.length) {
          await dialog.show('No saves found.', { title: 'Load Game' });
          continue;
        }
        const pick = await dialog.menu(
          'Choose a save:',
          [
            ...saves.slice(0, 10).map((s) => ({
              label: `${s.label} — ${s.playerName} (age ${s.age})`,
              value: s.id,
            })),
            { label: 'Cancel', value: null },
          ],
          { title: 'Load Game' }
        );
        if (!pick) continue;
        const loaded = loadSave(pick);
        if (!loaded) {
          await dialog.show('Save missing.', { title: 'Load Game' });
          continue;
        }
        return { action: 'load', game: loaded };
      }
    }
  }

  update() {
    this.blink += 1;
  }

  draw(ctx) {
    // dithered title backdrop
    const floor = makeTile('floor');
    for (let y = 0; y < VIEW_H; y += 16) {
      for (let x = 0; x < VIEW_W; x += 16) {
        ctx.drawImage(floor, x, y);
      }
    }
    ctx.fillStyle = 'rgba(10,8,16,0.55)';
    ctx.fillRect(0, 0, VIEW_W, VIEW_H);

    ctx.textAlign = 'center';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText("YOU CAN'T TAKE", VIEW_W / 2, 70);
    ctx.fillText('IT WITH YOU', VIEW_W / 2, 88);

    ctx.font = '7px "Press Start 2P", monospace';
    ctx.fillStyle = PALETTE.uiText;
    ctx.fillText('A 16-bit life ledger', VIEW_W / 2, 120);

    if (Math.floor(this.blink / 30) % 2 === 0) {
      ctx.fillStyle = PALETTE.accent;
      ctx.fillText('Press Enter', VIEW_W / 2, 180);
    }
    ctx.textAlign = 'left';
  }
}
