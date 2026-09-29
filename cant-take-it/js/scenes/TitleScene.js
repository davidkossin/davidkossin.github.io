import { PALETTE, VIEW_W, VIEW_H, CANVAS_H } from '../config.js';
import { deleteSave, hasSaves, listSaves, loadSave } from '../state/SaveSystem.js';
import { createStandardPortfolioSetup, createGameFromSetup } from '../state/GameState.js';
import { makeTile } from '../render/Assets.js';

const MAX_VISIBLE_SAVES = 10;

function saveIdentification(save) {
  return `${save.label} — ${save.playerName} (age ${save.age})`;
}

export class TitleScene {
  constructor(game) {
    this.game = game;
    this.blink = 0;
  }

  async enter() {
    // idle until menu choice via dialog from main
  }

  async runMenu(dialog) {
    while (true) {
      // Rebuild the title menu after save management so its save-dependent
      // entries disappear immediately when the final save is deleted.
      const opts = [{ label: 'New Game', value: 'new' }];
      if (hasSaves()) {
        opts.push({ label: 'Load Game', value: 'load' });
        opts.push({ label: 'Manage Saves', value: 'manage' });
      }
      opts.push({ label: 'How to Play', value: 'help' });
      const choice = await dialog.menu(
        'A life of choices.\nYou can\'t take it with you.',
        opts,
        { title: "You Can't Take It With You" }
      );

      if (choice === 'new') {
        const start = await this.chooseNewGame(dialog);
        if (!start) continue;
        return start;
      }
      if (choice === 'help') {
        await dialog.show(
          'WASD / Arrows move. Enter / Z / E talk. Esc opens Map/Charts (jump timelines). Walk the Hallway of Time — doors start the year after you leave. Wall windows change your portfolio. Auto-saves in localStorage.',
          { title: 'How to Play' }
        );
        continue;
      }
      if (choice === 'manage') {
        await this.manageSaves(dialog);
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
            ...saves.slice(0, MAX_VISIBLE_SAVES).map((s) => ({
              label: saveIdentification(s),
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

  /**
   * New Game submenu: Standard portfolio (skip setup) vs Custom setup.
   * @returns {Promise<{action:'new', mode:'standard'|'custom', game?:object}|null>}
   */
  async chooseNewGame(dialog) {
    const mode = await dialog.menu(
      'How do you want to begin?',
      [
        { label: 'Standard portfolio', value: 'standard', subtext: 'Typical US household — skip setup' },
        { label: 'Custom setup', value: 'custom', subtext: 'Full questionnaire' },
        { label: 'Cancel', value: null },
      ],
      { title: 'New Game' }
    );
    if (!mode) return null;

    if (mode === 'custom') {
      return { action: 'new', mode: 'custom' };
    }

    // Standard path: brief confirm, then ready-to-play Decision Room state
    const confirmed = await dialog.menu(
      'Average US household starter:\n' +
        'Age 40, married, 1 child (7).\n' +
        'Salary $78k · spend $35k/yr.\n' +
        'Home $380k ($270k mortgage).\n' +
        'Cash $5.5k · savings $15k ·\nstocks $22k · 401(k) $62k.\n' +
        'ZIP 85001 · Standard difficulty.\n' +
        'Glass wall ~6 years if unchanged.',
      [
        { label: 'Begin', value: true },
        { label: 'Back', value: false },
      ],
      { title: 'Standard portfolio' }
    );
    if (!confirmed) return null;

    const game = createGameFromSetup(createStandardPortfolioSetup());
    await dialog.show(
      `Welcome, ${game.portfolio.playerName}. Year ${game.portfolio.year}, age ${game.portfolio.age}. Your Decision Room awaits.`,
      { title: 'Begin' }
    );
    return { action: 'new', mode: 'standard', game };
  }

  async manageSaves(dialog) {
    while (true) {
      // Read the list on every pass so the menu reflects deletions immediately.
      const saves = listSaves();
      if (!saves.length) {
        await dialog.show('No saves found.', { title: 'Manage Saves' });
        return;
      }

      const pick = await dialog.menu(
        'Choose a save to delete:',
        [
          ...saves.slice(0, MAX_VISIBLE_SAVES).map((s) => ({
            label: saveIdentification(s),
            value: s.id,
          })),
          { label: 'Back', value: null },
        ],
        { title: 'Manage Saves' }
      );
      if (!pick) return;

      // Resolve the selected entry from the current list before confirming;
      // this keeps the confirmation text tied to the id being deleted.
      const save = saves.find((s) => s.id === pick);
      if (!save) continue;

      const confirmed = await dialog.menu(
        `Delete ${saveIdentification(save)}?`,
        [
          { label: 'Delete Save', value: true },
          { label: 'Cancel', value: false },
        ],
        // Cancellation is the safe default for this destructive action.
        { title: 'Manage Saves', selected: 1 }
      );
      if (!confirmed) continue;

      deleteSave(save.id);
      await dialog.show('Save deleted.', { title: 'Manage Saves' });
      if (!hasSaves()) {
        await dialog.show('No saves found.', { title: 'Manage Saves' });
        return;
      }
    }
  }

  update() {
    this.blink += 1;
  }

  draw(ctx) {
    // dithered title backdrop (full canvas incl. HUD band)
    const floor = makeTile('floor');
    for (let y = 0; y < CANVAS_H; y += 16) {
      for (let x = 0; x < VIEW_W; x += 16) {
        ctx.drawImage(floor, x, y);
      }
    }
    ctx.fillStyle = 'rgba(10,8,16,0.55)';
    ctx.fillRect(0, 0, VIEW_W, CANVAS_H);

    ctx.textAlign = 'center';
    ctx.font = '10px "Press Start 2P", monospace';
    ctx.fillStyle = PALETTE.gold;
    ctx.fillText("YOU CAN'T TAKE", VIEW_W / 2, 90);
    ctx.fillText('IT WITH YOU', VIEW_W / 2, 108);

    ctx.font = '6px "Press Start 2P", monospace';
    ctx.fillStyle = PALETTE.uiText;
    ctx.fillText('An existential interactive', VIEW_W / 2, 136);
    ctx.fillText('financial planner', VIEW_W / 2, 150);

    if (Math.floor(this.blink / 30) % 2 === 0) {
      ctx.fillStyle = PALETTE.accent;
      ctx.fillText('Press Enter', VIEW_W / 2, 200);
    }
    ctx.textAlign = 'left';
  }
}
