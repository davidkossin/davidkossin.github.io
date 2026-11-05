/**
 * Ordered scene registry. Add, remove, or reorder chapters here only.
 * Each entry is a scene module exporting the standard scene contract.
 */
import cosmicDawn from "./scenes/01-cosmic-dawn.js?v=d130905";
import ancestorStar from "./scenes/02-ancestor-star.js?v=d130905";
import solarSystem from "./scenes/03-solar-system.js?v=d130905";
import earthAndLife from "./scenes/04-earth-and-life.js?v=d130905";
import humans from "./scenes/05-humans.js?v=d130905";
import machines from "./scenes/06-machines.js?v=d130905";
import generation from "./scenes/07-generation.js?v=d130905";
import finale from "./scenes/07-finale.js?v=d130905";

/** @type {import('./engine.js').Scene[]} */
export const scenes = [
  cosmicDawn,
  ancestorStar,
  solarSystem,
  earthAndLife,
  humans,
  machines,
  generation,
  finale,
];
