import { scenes } from "./registry.js?v=cea7ac7";
import { createEngine } from "./engine.js?v=fade1";

const canvas = document.getElementById("timeline-canvas");
const ui = {
  scrubber: document.querySelector(".scrubber"),
  track: document.getElementById("scrub-track"),
  thumb: document.getElementById("scrub-thumb"),
  fill: document.getElementById("scrub-fill"),
  ticks: document.getElementById("scrub-ticks"),
  eras: document.getElementById("scrub-eras"),
  slider: document.getElementById("scrub-track"),
  playBtn: document.getElementById("play-btn"),
  placard: document.getElementById("placard"),
  placardTime: document.getElementById("placard-time"),
  placardTitle: document.getElementById("placard-title"),
  placardBody: document.getElementById("placard-body"),
  placardChapter: document.getElementById("placard-chapter"),
  live: document.getElementById("live"),
};

window.__hsm = createEngine({ canvas, scenes, ui });
