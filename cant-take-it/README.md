# You Can't Take It With You

A 16-bit, top-down life & finance RPG (A Link to the Past vibe) playable in the browser.

**Live:** [https://davidkossin.github.io/cant-take-it/](https://davidkossin.github.io/cant-take-it/)

## How to play

1. **Title** — New Game (Standard portfolio or Custom setup), Load Game, or Manage Saves (localStorage).
2. **Setup** — Custom: LTTP-styled prompts with **Back** on every step: name, year, age, appearance, starting **Cash**, annual household gross salary, savings (+ interest %), **401(k)** (balance, contribution %, employer match), homes (rate as %), stocks (total only), family (kid **name** + age), spending, ZIP, difficulty.
3. **Decision Room** — Walk with WASD / arrows. Wall-embedded teller windows (`Enter` / `Z` / `E`), layout W2 / S2 / E2:
   - Buy / Sell Home
   - Buy / Sell Stock (capital gains tax on sell)
   - Have A Kid (name only → age 0)
   - Large Purchase
   - Job / Retire
   - **Borrow** — HELOC or loan against shares (asset-backed only; APRs shown)
4. **North door** — “Hallway of Time.” Confirm leaving the year.
5. **Hallway** — Narrow corridor through a dark purple stippled void. First door = **leave year + 1**. HUD age / year / Cash / portfolio project forward (deterministic). A **glass wall** blocks years where Cash would hit ≤ $0. Lanterns flicker beside doors.
6. **Esc** — Pause: **Portfolio** (holdings / net worth), **Map** (timeline tree — time ↑, forks ↗ right as Y branches; jump back to a Hallway node; **C Compare** selects two timelines and a year for side-by-side portfolio snapshots), and **Charts** (current-path net worth).
7. **Age 100** — “End of the Line.” Ending → See your charts / New Game.
8. **Saves** — Auto-save on entering a year’s room and when entering the hallway (`ycitwy_saves_v2`).

## Controls

| Action | Keys |
|--------|------|
| Move | WASD / Arrow keys |
| Confirm / Talk | Enter, Space, Z, E |
| Cancel / Pause | Escape, X |
| Pause tabs | Tab |

## Architecture

```
cant-take-it/
  index.html          # canvas shell, ES module entry
  css/game.css
  README.md
  js/
    main.js           # scene loop, input, pause, transitions
    config.js         # palette, difficulty presets, constants
    state/
      GameState.js    # setup → game, timeline graph + snapshots
      SaveSystem.js   # localStorage begin/end slots
    finance/          # pure JS — no DOM
      Engine.js       # projectOneYear, worth, decisions, CGT sells
      Tax.js          # federal brackets, ZIP→state, capital gains
      Difficulty.js
      Events.js       # college, retirement, SS stub, shocks
      rng.js          # seeded / deterministic PRNG
    scenes/
      TitleScene.js
      SetupScene.js
      RoomScene.js
      HallwayScene.js
      EndingScene.js
      PauseMenu.js    # Map + Charts
    render/
      Assets.js       # procedural pixel sprites (walk cycle, void, lamps)
      Dialog.js       # SNES-style boxes (money commas, %)
      Hud.js          # floating LTTP icon clusters
      Player.js       # 4-dir walk animation
      World.js        # tilemaps, wall windows, hallway void
      Charts.js       # net-worth line charts
    data/
      tax-brackets.js
      state-from-zip.js
```

Vanilla ES modules + Canvas. No build step. GitHub Pages serves the folder as static files.

## Financial engine — formulas

### Net worth & HUD

- **Cash** (HUD) = `cash` only (liquid cash on hand).
- **Portfolio** (HUD) = net worth = `cash + savings + stocksTotal + k401Balance + homeEquity − otherDebt − otherLoans.principal`.
- Savings still earn interest; 401(k) is illiquid for Decision Room spending but counts in Portfolio.
- Traditional 401(k) withdrawals in retirement refill Cash (taxable); not available while working.
- `stocksCostBasis` tracks tax basis: **buy** increases basis by purchase amount; **sell** reduces basis proportionally to `proceeds / stocksTotal`.

### Annual projection (`projectOneYear`)

1. Age player + kids; year++.
2. Inflate `childCostInflator *= (1 + inflation)`.
3. Auto events: retirement at 65, college 18–22, optional SS, random shock (skipped if `deterministic`).
4. Salary growth if employed: `salary *= (1 + salaryGrowth)`.
5. Savings interest: `savings += savings * savingsRate`.
6. Equity return: stocks and **401(k)** grow with `equityReturn * noise`.
   - Hallway / HUD projection uses **`deterministic: true`** (noise = 1, no shocks) so numbers don’t jitter.
6b. While employed: 401(k) employee deferral = `min(salary × contribRate, K401_EMPLOYEE_LIMIT)`; employer match = `min(deferral, salary × matchOnFirst) × matchRate`; deferral reduces disposable income and taxable wages; match does not come from player cash.
7. Home appreciation: `value *= (1 + inflation + 0.005)`.
8. Mortgage: one year of P&I; interest = `owed * rate`; principal = payment − interest.
8b. **Other loans** (financed large purchases, **HELOC**, **loan against shares**): same P&I amortization on `otherLoans[]` (`principal`, `rate`, `remainingTerm`); interest + principal payment is an annual cash-flow expense; payoff logged when principal clears. Securities loans: if principal > `SB_LTV × stocksTotal`, margin call liquidates stock → Cash → pay down loan.
9. **Child costs** (USDA-style bands, every year, *not* a flat +$8k on birth):
   - Ages 0–5: ~$13,500 / yr  
   - Ages 6–12: ~$14,500 / yr  
   - Ages 13–17: ~$16,000 / yr  
   - Scaled by `expensePressure × childCostInflator`.
10. **College tuition (ages 18–21):** `NATIONAL_AVG_COLLEGE_COST` ($11,610 — College Board 2024–25 public 4-year in-state average tuition & fees) × `expensePressure` × `childCostInflator`, added to annual outflow. One-shot log “{name} goes to college” at age 18; yearly “{name} — college tuition”. **Not** double-counted with USDA child bands (0–17 only).
11. Income tax (federal brackets + ZIP state) + property tax.
12. Cash flow: inflow = salary (or 0 if retired) + simplified SS; outflow = spending × pressure + mortgage + other loans + taxes + child costs + 401(k) deferral. **Surplus → Cash**; deficit drains **savings → taxable stocks → (retired: 401(k) → Cash, proceeds applied to shortfall) → Cash** (stocks basis adjusted). Remaining gap → `otherDebt`.

### Hallway life-event auras

Deterministic projection logs mark major one-shots as soft cyan/violet/gold bands across the corridor (floor + E/W walls). Crossing a band shows a bottom banner: mortgage/loan paid off, Retired, “{child} goes to college”. Movement is never blocked.

### Hallway insolvency glass wall

Using the same deterministic `projectYears` snapshots as the HUD: the first future year where Cash (`cash`) would be ≤ 0 after that year’s simulation places a translucent cyan glass barrier across the corridor at/before that year’s door. The player cannot walk past it; bumping shows a message to enter an earlier year’s Decision Room and rebuild Cash. Earlier doors south of the wall remain usable.

### Large purchase (cash or financed)

1. Enter purchase amount.
2. **Financed?** No → pay full amount from liquid (cash → savings → stocks); shortfall → `otherDebt`.
3. Yes → down payment (from liquid), interest rate (%), loan term (years, default 5). Remaining principal becomes an `otherLoans` entry and amortizes each year like a mortgage.


### Borrow (HELOC / loan against shares)

Asset-backed only (no unsecured “just borrow money”).

- **HELOC:** capacity per home = `max(0, HELOC_CLTV(0.80) × value − mortgage − existing HELOCs on that home)`. Default APR **8.5%** (mid-2020s prime + margin; adjustable 6–12%). Term 10–30 yr amortizing. Proceeds → Cash. Selling the home pays off its HELOC lien first.
- **Loan against shares:** capacity = `max(0, SB_LTV(0.50) × stocksTotal − existing securities loans)`. Against taxable brokerage only — **not** 401(k). Default APR **7.0%** (adjustable 5.5–9%). Amortizing; margin call if over LTV.

### 401(k)

- Setup: balance, contribution % of salary, employer match (% of deferrals) + match-on-first (% of salary).
- Annual employee deferral capped at `K401_EMPLOYEE_LIMIT` ($23,500, TY 2025 spirit).
- Grows with difficulty stock-like return; illiquid for Decision Room; in Portfolio.
- Retired only: auto-withdraw to cover Cash shortfalls; withdrawals taxed as ordinary income.

### Capital gains on stock sale

Player enters **sale amount** (or % of portfolio), **realized gains $**, and **years held**.

- `yearsHeld ≥ 1` → long-term federal CGT ≈ **15%** of gains (`LTCG_FEDERAL_RATE`).
- `yearsHeld < 1` → short-term: tax gains as ordinary income (difference in federal tax with/without gains).
- State CGT ≈ ZIP state income-tax rate × gains.
- Net cash to Cash = `proceeds − (federal + state CGT)`.
- `stocksTotal` reduced by proceeds; basis reduced proportionally.

*Illustrative gameplay model — not tax advice.*

### Social Security stub

If retired and age ≥ 65: `socialSecurity ≈ 0.35 × peakSalary` (simplified; not an SSA formula). Added to annual inflow.

### Random shocks

Chance and max amount scale with difficulty (`shockChance`, `shockMax`). Disabled when `deterministic` (hallway projection).

### Difficulty presets

| | Easy | Standard (default) | Difficult |
|--|--|--|--|
| Subtext | World becomes better for all | Relatively stable | Grim — harder for everyone |
| Inflation | 2% | 2.5% | 3.5% |
| Equity | 9% | 7% | 4.5% |
| Expense pressure | 0.9 | 1.0 | 1.2 |

### Rates in the UI

Interest / mortgage rates are **entered as percent** (e.g. `3.2` means 3.2%). Stored internally as decimals (`0.032`). Money fields format with **commas** while typing.

### Timeline / pause map

Each Decision Room and Hallway visit appends a node with a portfolio snapshot (`parentId` tree). Entering a Decision Room from a parent that already has children **forks** a new timeline. Esc → Map draws a vertical **TREE** (time ↑, past/start at bottom and age 100 at top; forks ↗ right as Y branches): Timeline 1/2/3… with points **A** (start), **B/B2…** (Decision Room forks), **C** (age 100). The Hallway jump list still restores a branch, and **C Compare** selects two timelines plus a year for side-by-side portfolio snapshots; Charts stays on the current path. Live `worthHistory` is the current path only.

## Extending

- **New teller action:** add interactable in `World.buildDecisionRoom`, handle in `RoomScene.handleTeller`, mutate via `finance/Engine.js`.
- **Richer art:** replace procedural canvases in `render/Assets.js` with PNGs under `assets/` (optional `lttp-walk.*` walk sheets).
- **Live tax:** implement `fetchLiveTaxHint` and merge into `estimateAnnualTax`.

## Local dev

```bash
# from repo root
python3 -m http.server 8080
# open http://localhost:8080/cant-take-it/
```

## License / art

Original procedural pixel art inspired by SNES-era aesthetics — not Nintendo assets. Financial figures are illustrative gameplay estimates, not advice.
