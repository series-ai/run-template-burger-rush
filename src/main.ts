// =============================================================================
// Burger Shop Demo - Main Entry Point
// =============================================================================
import "./styles/main.css";
import { BurgerShopDemo } from "./burgershop/BurgerShopDemo";
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"

// Simple entry point for Three.js demo
(async function () {
  // Starting demo

  try {
    // Create and start the demo
    const demo = await BurgerShopDemo.create();

    // Make demo available for debugging
    (window as any).demo = demo;
    (window as any).game = demo; // Keep same variable name for debugging consistency

    // Demo is running
  } catch (error) {
    console.error("❌ Failed to start Three.js Burger Shop Demo:", error);
  }
})();
