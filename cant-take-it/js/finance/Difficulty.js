import { DIFFICULTIES } from '../config.js';

export function getDifficulty(id) {
  return DIFFICULTIES[id] || DIFFICULTIES.standard;
}

export function listDifficulties() {
  return Object.values(DIFFICULTIES);
}
