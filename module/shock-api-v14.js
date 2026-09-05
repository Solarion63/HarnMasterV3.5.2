import { shockRoll } from "./shock-workflow-v14.js";

/**
 * Replace the historical public Shock Roll macro entry point after HM3 builds
 * game.hm3 during init. This keeps existing user macros compatible while
 * routing them through the optional v14 Shock workflow.
 */
Hooks.once("init", () => {
  if (!game.hm3?.macros) return;
  game.hm3.macros.shockRoll = shockRoll;
});
