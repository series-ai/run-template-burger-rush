/**
 * Example showing how to integrate Custom Navigation into BurgerShopSim
 *
 * To use this:
 * 1. Add this import to BurgerShopSim.ts:
 *    import { CustomNavIntegration } from "./integration-example";
 *
 * 2. Call from BurgerShopSim.onStart():
 *    await CustomNavIntegration.setupCustomNavigation(this.scene);
 *
 * 3. Call from BurgerShopSim.onDispose():
 *    CustomNavIntegration.cleanup();
 */

//NOTE(Zee): Commented out a bunch of stuff, not sure if this class even usable
export class CustomNavIntegration {
  /**
   * Set up custom navigation for the burger shop
   */
  public static async setupCustomNavigation(scene: any): Promise<void> {
    console.log("🗺️ Integrating Custom Navigation into Burger Shop...")

    // Initialize with burger shop world dimensions
    // The burger shop uses a 3x3 grid with 10 unit tiles = 30x30 world
    // We'll use a larger area to be safe and smaller grid cells for precision
    //const navSystem = CustomNavigationSystem.initialize(scene, 50, 50, 1.0)

    console.log("🗺️ Custom Navigation integrated!")

    // Optional: Create a test obstacle to verify the system works
    // Uncomment this to see it in action:
    // await CustomNavDemo.setupCustomNavigation(scene);

    return Promise.resolve()
  }

  /**
   * Add navigation obstacles to existing burger shop objects
   * Call this after all your game objects are created
   */
  public static addNavigationObstacles(): void {
    console.log("🧱 Adding navigation obstacles to burger shop objects...")

    // Example: You would add NavObstacleComponent to your existing objects
    // This is pseudo-code showing the concept:

    /*
        // Add obstacles to burger stations
        if (burgerStation) {
            burgerStation.getGameObject().addComponent(new NavObstacleComponent());
        }
        
        // Add obstacles to checkout stations  
        if (checkoutStation) {
            checkoutStation.getGameObject().addComponent(new NavObstacleComponent());
        }
        
        // Add obstacles to tables
        [table1, table2, table3, table4].forEach(table => {
            if (table) {
                table.getGameObject().addComponent(new NavObstacleComponent());
            }
        });
        
        // Walls and other static obstacles would also get the component
        */

    console.log("🧱 All burger shop obstacles added to navigation system")
  }

  /**
   * Test the navigation system with burger shop layout
   */
  public static testBurgerShopNavigation(): void {
    // const navSystem = CustomNavigationSystem.getInstance()
    // if (!navSystem) {
    //   console.error("Navigation system not initialized")
    //   return
    // }

    console.log("🚶 Testing walkability in burger shop areas...")

    // Test common burger shop positions
    const testPositions = [
      { x: 0, z: 0, description: "Center of shop" },
      { x: -3, z: 13.5, description: "Burger station area" },
      { x: -1, z: 5, description: "Checkout area" },
      { x: -6, z: 0, description: "Table area" },
      { x: 10, z: 10, description: "Customer walking area" },
    ]

    for (const pos of testPositions) {
      // const walkable = navSystem.isWalkable(pos.x, pos.z)
      // console.log(
      //   `${pos.description} (${pos.x}, ${pos.z}): ${walkable ? "✅ Walkable" : "❌ Blocked"}`,
      // )
    }

    // Print the grid for debugging
    // navSystem.debugPrintGrid()
  }

  /**
   * Clean up the navigation system
   */
  public static cleanup(): void {
    console.log("🧹 Cleaning up Custom Navigation...")
    // CustomNavigationSystem.dispose()
  }
}

/*
INTEGRATION STEPS FOR BURGERSHOPSIM:

1. In BurgerShopSim.onStart(), add after existing setup:
   ```typescript
   // Set up custom navigation
   await CustomNavIntegration.setupCustomNavigation(this.scene);
   ```

2. After creating all your stations, add:
   ```typescript
   // Add navigation obstacles
   CustomNavIntegration.addNavigationObstacles();
   ```

3. In BurgerShopSim.onDispose(), add:
   ```typescript
   // Clean up custom navigation
   CustomNavIntegration.cleanup();
   ```

4. For existing game objects that should be obstacles, add the component:
   ```typescript
   // Example: Make the burger station an obstacle with mesh data
   const renderer = burgerStationObject.getComponent(ObjRenderer);
   const options: NavObstacleOptions = renderer ? { mesh: renderer.getMesh() } : {};
   burgerStationObject.addComponent(new NavObstacleComponent(options));
   
   // Alternative: Use manual bounds if you know the size
   burgerStationObject.addComponent(new NavObstacleComponent({
       bounds: { width: 4, height: 2, depth: 2 }
   }));
   ```

5. For AI agents that need to navigate, use:
   ```typescript
   const navSystem = CustomNavigationSystem.getInstance();
   const canWalk = navSystem.isWalkable(targetX, targetZ);
   ```
*/
