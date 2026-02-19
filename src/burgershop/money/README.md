# Unlock System

A centralized dependency-based unlock system for game components.

## Overview

The UnlockManager handles ALL dependency logic centrally. Components just implement `IUnlockable` with a simple `unlock()` method. The main simulation sets up all dependencies in one place.

**Key Features:**

- Uses GameObject IDs as keys (automatically unique)
- Components passed directly (type-safe, no strings)
- Centralized dependency setup
- Two states: **Unlocked** (available for purchase) → **Acquired** (purchased/built)

## Usage

### 1. Component Implementation (Ultra Simple)

```typescript
export class MyStation extends Component implements IUnlockable {
  constructor() {
    super()
  }

  protected onCreate() {
    // Start disabled - no registration needed here!
    this.gameObject.setEnabled(false)
    this.setupPurchaseArea()
  }

  // Only method needed - called when available for purchase
  public unlock(): void {
    console.log("Station available for purchase!")
    this.gameObject.setEnabled(true)
  }

  // When purchased, notify the manager
  private onPurchaseComplete(): void {
    UnlockManager.acquire(this) // This triggers cascade unlocks
  }
}
```

### 2. Centralized Setup (in BurgerShopSim)

```typescript
export class BurgerShopSim {
  private burgerStation!: BurgerStation
  private drinkStation!: DrinkStation
  private friesStation!: FriesStation

  private setupStations(): void {
    // Create all stations
    const burgerStationObj = new GameObject("BurgerStation")
    this.burgerStation = new BurgerStation()
    burgerStationObj.addComponent(this.burgerStation)

    const drinkStationObj = new GameObject("DrinkStation")
    this.drinkStation = new DrinkStation()
    drinkStationObj.addComponent(this.drinkStation)

    // ... create more stations
  }

  private setupDependencies(): void {
    console.log("🏪 Setting up unlock dependencies...")

    // Register with dependencies - super clean!
    UnlockManager.register(this.burgerStation, []) // No dependencies
    UnlockManager.register(this.drinkStation, [this.burgerStation])
    UnlockManager.register(this.friesStation, [this.drinkStation])
    UnlockManager.register(this.advancedGrill, [
      this.burgerStation,
      this.friesStation,
    ])

    // Start the chain - burger station is acquired immediately
    UnlockManager.acquire(this.burgerStation)
  }
}
```

## Key Benefits

1. **Ultra Simple Components**: Just implement `unlock()` - no registration, no dependency management
2. **Centralized Setup**: All dependencies defined in one place in your main sim
3. **Type-Safe**: Direct component references, no string IDs to manage
4. **Automatic Keys**: Uses GameObject.id internally (unique, debuggable)
5. **Clean Dependencies**: `register(component, [dep1, dep2])` - super readable

## Flow

1. **BurgerShopSim** creates all stations
2. **BurgerShopSim** calls `UnlockManager.register(station, dependencies)` for each
3. **UnlockManager** calls `station.unlock()` when dependencies are met
4. When purchased, station calls `UnlockManager.acquire(this)`
5. **UnlockManager** automatically checks and unlocks newly available items

## API

### IUnlockable Interface

- `unlock(): void` - Called when this should be made available for purchase

### UnlockManager Static Methods

- `register(component, dependencies)` - Register with dependencies
- `acquire(component)` - Mark as purchased (triggers cascade unlocks)
- `isUnlocked(component)` - Check if available for purchase
- `isAcquired(component)` - Check if purchased/built
- `reset()` - Reset all state (for testing)

## Example Dependency Chain

```typescript
// Burger station (no deps) → unlocked immediately
UnlockManager.register(burgerStation, [])

// Drink station needs burger station
UnlockManager.register(drinkStation, [burgerStation])

// Advanced grill needs both burger AND fries
UnlockManager.register(advancedGrill, [burgerStation, friesStation])
```
