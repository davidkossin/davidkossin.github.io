import { startLagrange } from "./lagrange.js";
startLagrange({
  missionsUrl: "../data/lagrange-missions.json?v=lg6",
  trajUrl: "../data/lagrange-traj.json?v=lg6",
});
