/**
 * Ordered scene registry. Add, remove, or reorder chapters here only.
 * Each entry is a scene module exporting the standard scene contract.
 */
import cosmicDawn from "./scenes/01-cosmic-dawn.js?v=8383abd";
import ancestorStar from "./scenes/02-ancestor-star.js?v=8383abd";
import solarSystem from "./scenes/03-solar-system.js?v=8383abd";
import earthAndLife from "./scenes/04-earth-and-life.js?v=8383abd";
import humans from "./scenes/05-humans.js?v=8383abd";
import machines from "./scenes/06-machines.js?v=8383abd";
import finale from "./scenes/07-finale.js?v=8383abd";

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
