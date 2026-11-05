/**
 * Ordered scene registry. Add, remove, or reorder chapters here only.
 * Each entry is a scene module exporting the standard scene contract.
 */
import cosmicDawn from "./scenes/01-cosmic-dawn.js?v=e6afa06";
import ancestorStar from "./scenes/02-ancestor-star.js?v=e6afa06";
import solarSystem from "./scenes/03-solar-system.js?v=e6afa06";
import earthAndLife from "./scenes/04-earth-and-life.js?v=e6afa06";
import humans from "./scenes/05-humans.js?v=e6afa06";
import machines from "./scenes/06-machines.js?v=e6afa06";
import finale from "./scenes/07-finale.js?v=e6afa06";

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
