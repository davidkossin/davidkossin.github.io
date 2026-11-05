/**
 * Ordered scene registry. Add, remove, or reorder chapters here only.
 * Each entry is a scene module exporting the standard scene contract.
 */
import cosmicDawn from "./scenes/01-cosmic-dawn.js?v=b69902c";
import ancestorStar from "./scenes/02-ancestor-star.js?v=b69902c";
import solarSystem from "./scenes/03-solar-system.js?v=b69902c";
import earthAndLife from "./scenes/04-earth-and-life.js?v=b69902c";
import humans from "./scenes/05-humans.js?v=b69902c";
import machines from "./scenes/06-machines.js?v=b69902c";
import finale from "./scenes/07-finale.js?v=b69902c";

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
