import "./shock-turn-v14.js";
import "./shock-out-of-combat-v14.js";
import { shockRoll } from "./shock-workflow-v14.js";

/**
 * Bootstrap the v14 Shock automation from a single manifest entry.
 *
 * The turn-based and world-time recovery services are imported here so they
 * cannot be omitted or loaded in an inconsistent order when the Shock API is
 * present. ES module caching ensures each service registers its hooks once.
 *
 * Replace the historical public Shock Roll macro entry point after HM3 builds
 * game.hm3 during init. This keeps existing user macros compatible while
 * routing them through the optional v14 Shock workflow.
 */
Hooks.once("init", () => {
  if (!game.hm3?.macros) return;
  game.hm3.macros.shockRoll = shockRoll;
});
