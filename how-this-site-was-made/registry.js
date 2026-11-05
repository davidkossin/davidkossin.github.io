/**
 * Ordered scene registry. Add, remove, or reorder chapters here only.
 * Each entry is a scene module exporting the standard scene contract.
 */
import cosmicDawn from "./scenes/01-cosmic-dawn.js?v=eb09baa";
import ancestorStar from "./scenes/02-ancestor-star.js?v=eb09baa";
import solarSystem from "./scenes/03-solar-system.js?v=eb09baa";
import earthAndLife from "./scenes/04-earth-and-life.js?v=eb09baa";
import humans from "./scenes/05-humans.js?v=eb09baa";
import machines from "./scenes/06-machines.js?v=eb09baa";
import finale from "./scenes/07-finale.js?v=eb09baa";

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
