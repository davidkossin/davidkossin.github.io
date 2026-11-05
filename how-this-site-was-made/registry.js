/**
 * Ordered scene registry. Add, remove, or reorder chapters here only.
 * Each entry is a scene module exporting the standard scene contract.
 */
import cosmicDawn from "./scenes/01-cosmic-dawn.js?v=cea7ac7";
import ancestorStar from "./scenes/02-ancestor-star.js?v=cea7ac7";
import solarSystem from "./scenes/03-solar-system.js?v=cea7ac7";
import earthAndLife from "./scenes/04-earth-and-life.js?v=cea7ac7";
import humans from "./scenes/05-humans.js?v=cea7ac7";
import machines from "./scenes/06-machines.js?v=cea7ac7";
import generation from "./scenes/07-generation.js?v=cea7ac7";
import finale from "./scenes/07-finale.js?v=cea7ac7";

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
