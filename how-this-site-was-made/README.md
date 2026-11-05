# How This Site Was Made

Interactive scrubbable timeline for Objects In Space (`/how-this-site-was-made/`).
A cinematic tour from the Big Bang to the day this site was built.

## Architecture (revision-friendly)

Scenes are self-contained modules. The timeline **engine never hard-codes chapter content**.

```
how-this-site-was-made/
  index.html          # shell: canvas, scrubber chrome, placard
  styles.css
  main.js             # boot: loads registry, starts engine
  engine.js           # scrubber, play/pause, crossfade, keyboard/touch
  registry.js         # ordered list of scene modules only
  util.js             # shared math, noise, adaptive quality helpers
  scenes/
    01-cosmic-dawn.js
    02-ancestor-star.js
    03-solar-system.js
    04-earth-and-life.js
    05-humans.js
    06-machines.js
    07-generation.js   # prompt → tokens → network → code → publish → delivery
    07-finale.js        # page assembles; you are here
  README.md
```

### Scene module contract

Each scene file default-exports an object:

| Field | Purpose |
|---|---|
| `id` | Stable string key |
| `title` | Chapter title (era label on scrubber) |
| `weight` | Relative scrubber width (higher = more drag space) |
| `checkpoints[]` | Placard data + `at` in `[0,1]` local progress |
| `render(ctx, localProgress, view)` | Pure draw for this chapter |

**Checkpoint fields:** `id`, `at` (0–1), `timeLabel`, `title`, `body` (2–4 sentences). Placard copy lives here — not inside `render`.

**`view` argument:** `{ w, h, dpr, quality, reducedMotion, time, safeContent }` where `quality` is `0–1` (engine lowers it if frames are slow).

**`view.safeContent`:** `{ x, y, w, h, cx, cy }` — the largest practical rectangle **not covered** by the museum placard, top brand, or bottom scrubber. On desktop this is usually to the right of the placard; on mobile it is usually below the placard. Center titles, planets, stars, and other focal art at `(cx, cy)` (or within `x,y,w,h`) so they never collide with UI chrome.

### Editing rules

- **Add / remove / reorder a chapter:** edit `registry.js` only (import + array order). Adjust `weight` if the scrubber feels cramped.
- **Change placard text or checkpoint times:** edit that scene’s `checkpoints` array.
- **Change visuals:** edit that scene’s `render` (and helpers in the same file). Neighbor scenes and the engine stay untouched.
- **Crossfades:** the engine blends neighboring `render` calls near chapter boundaries. Scenes should tolerate being drawn at `localProgress` 0 and 1.

### Time mapping

Absolute cosmic time is *not* linear on the scrubber. Each chapter owns a slice of scrubber space via `weight`. Within Cosmic Dawn, visual eras use soft blends across local progress so microseconds and hundreds of Myr both get readable motion (early-universe `at` values are spaced for the scrubber; placard labels carry the scientific times).

### Motion & accessibility

Default is **paused** (scrub-driven). **Play** holds about 10 seconds on each checkpoint so the placard can be read, then eases smoothly to the next. **Prev** / **Next** (and the arrow keys) ease to the neighboring checkpoint. `prefers-reduced-motion: reduce` disables autoplay; scrubbing and Prev/Next still work. All camera-like motion stays slow — no fast zooms or rushing starfields. Adaptive quality reduces particle counts and resolution when frame times are high.

### Prompt-to-page chapter

`07-generation.js` sits between Machines and Finale. It owns the 22 September 2026 sequence: natural-language request, tokenization (subword pieces → IDs → embeddings), transformer self-attention, autoregressive generation of HTML/CSS/JS, Git commit/push to GitHub Pages, and HTTPS delivery — then Finale paints the assembled page. Keep that chapter factual (no model names, parameter counts, or hardware claims). Reorder or drop it only via `registry.js`.
