/**
 * Ordered scene registry. Add, remove, or reorder chapters here only.
 * Each entry is a scene module exporting the standard scene contract.
 */
import cosmicDawn from "./scenes/01-cosmic-dawn.js?v=a09b8da";
import ancestorStar from "./scenes/02-ancestor-star.js?v=a09b8da";
import solarSystem from "./scenes/03-solar-system.js?v=a09b8da";
import earthAndLife from "./scenes/04-earth-and-life.js?v=a09b8da";
import humans from "./scenes/05-humans.js?v=a09b8da";
import machines from "./scenes/06-machines.js?v=a09b8da";
import finale from "./scenes/07-finale.js?v=a09b8da";

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
