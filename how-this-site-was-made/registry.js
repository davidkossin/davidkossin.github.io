/**
 * Ordered scene registry. Add, remove, or reorder chapters here only.
 * Each entry is a scene module exporting the standard scene contract.
 */
import cosmicDawn from "./scenes/01-cosmic-dawn.js";
import ancestorStar from "./scenes/02-ancestor-star.js";
import solarSystem from "./scenes/03-solar-system.js";
import earthAndLife from "./scenes/04-earth-and-life.js";
import humans from "./scenes/05-humans.js";
import machines from "./scenes/06-machines.js";
import finale from "./scenes/07-finale.js";

/** @type {import('./engine.js').Scene[]} */
export const scenes = [
  cosmicDawn,
  ancestorStar,
  solarSystem,
  earthAndLife,
  humans,
  machines,
  finale,
];
