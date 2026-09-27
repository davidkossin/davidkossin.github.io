# You Can't Take It With You

A 16-bit, top-down life & finance RPG (A Link to the Past vibe) playable in the browser.

**Live:** [https://davidkossin.github.io/cant-take-it/](https://davidkossin.github.io/cant-take-it/)

## How to play

1. **Title** — New Game or Load Game (localStorage).
2. **Setup** — Answer LTTP-styled prompts: name, year, age, appearance, cash, salary, savings, homes, stocks, family, spending, ZIP, difficulty.
3. **Decision Room** — Walk with WASD / arrows. Talk to bank-teller windows (`Enter` / `Z` / `E`):
   - Buy / Sell home
   - Sell stock
   - Leave / start job / retire
   - Have a kid
   - Large purchase
4. **North door** — “Hallway of Time.” Confirm leaving the year.
5. **Hallway** — Walk north; HUD age / year / net worth project forward. Left markers = years; right doors = enter that year’s Decision Room (new timeline branch). Oil lamps every 5 years.
6. **Age 100** — “End of the Line.” Choose fear or courage. Ending → any key → new game.
7. **Saves** — Auto-save on entering a year’s room (“Begin of YEAR”) and when entering the hallway from a room (“End of YEAR”).

## Controls

| Action | Keys |
|--------|------|
| Move | WASD / Arrow keys |
| Confirm / Talk | Enter, Space, Z, E |
| Cancel | Escape, X |

## Architecture

```
cant-take-it/
  index.html          # canvas shell, ES module entry
  css/game.css
  README.md
  js/
    main.js           # scene loop, input, transitions
    config.js         # palette, difficulty presets, constants
    state/
      GameState.js    # setup → game, timeline nodes
      SaveSystem.js   # localStorage begin/end slots
    finance/          # pure JS — no DOM
      Engine.js       # projectOneYear, worth, decisions
      Tax.js          # federal brackets + ZIP→state (offline)
      Difficulty.js
      Events.js       # college, retirement, shocks
    scenes/
      TitleScene.js
      SetupScene.js
      RoomScene.js
      HallwayScene.js
      EndingScene.js
    render/
      Assets.js       # procedural pixel sprites
      Dialog.js       # SNES-style boxes
      Hud.js
      Player.js
      World.js        # tilemaps, interactables
    data/
      tax-brackets.js # curated federal tables + inflation fallback
      state-from-zip.js
```

Vanilla ES modules + Canvas. No build step. GitHub Pages serves the folder as static files.

### Financial engine

- `projectOneYear(state, difficulty)` advances age/year, salary growth, savings interest, equity returns (with noise), home appreciation, mortgage amortization, taxes, spending cash-flow.
- Net worth = liquid (cash + savings + stocks) + home equity − other debt.
- Difficulty presets scale inflation, equity return, salary growth, expense pressure, tax multiplier, college cost.
- Timeline: each Decision Room visit stores a **baseline** node; the hallway projects from that node.

### Tax hooks (offline first)

- Static federal brackets in `data/tax-brackets.js` (inflate when year missing).
- ZIP → approximate state + flat-ish state income tax in `data/state-from-zip.js`.
- `Tax.fetchLiveTaxHint(year)` is a stub for future IRS / Tax Foundation `fetch`. Game must work offline with defaults.

## Extending

- **New teller action:** add interactable in `World.buildDecisionRoom`, handle in `RoomScene.handleTeller`, mutate via `finance/Engine.js`.
- **Richer art:** replace procedural canvases in `render/Assets.js` with PNGs under `assets/`.
- **Live tax:** implement `fetchLiveTaxHint` and merge into `estimateAnnualTax`.
- **Phaser:** optional later; current Canvas stack keeps Pages deploy trivial.

## Local dev

```bash
# from repo root
python3 -m http.server 8080
# open http://localhost:8080/cant-take-it/
```

## License / art

Original procedural pixel art inspired by SNES-era aesthetics — not Nintendo assets. Financial figures are illustrative gameplay estimates, not advice.
