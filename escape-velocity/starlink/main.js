import { startConstellation } from "../constellation.js";

startConstellation({
  dataUrl: "../data/starlink.json?v=cl1",
  coastUrl: "../data/coastline.json?v=cl1",
});
