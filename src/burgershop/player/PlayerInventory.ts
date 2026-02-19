import * as THREE from "three"
import { Inventory } from "@game/inventory/Inventory"
import { Item } from "@game/inventory/Item"
import { ItemStack } from "@game/inventory/ItemStack"
import { MaxIndicator } from "@game/ui/MaxIndicator"
import { Audio2D } from "@series-inc/rundot-3d-engine/systems"

// Constants for item stack positioning and UI
const STACK_POSITION = new THREE.Vector3(0, 1, 0.9)
const MAX_INDICATOR_HEIGHT_OFFSET = 0.8

/**
 * Player inventory component for Three.js that follows the player and holds items
 */
export class PlayerInventory extends Inventory {
  private itemStack!: ItemStack
  private maxIndicator!: MaxIndicator

  // Audio component for pickup sounds
  private audioComponent: Audio2D | null = null

  // Static inventory size that can be modified by upgrades
  // Default is 2 (level 0 from UpgradeManager config)
  public static maxInventorySize: number = 2

  /**
   * Get the current maximum items based on upgrades
   */
  public get maxItems(): number {
    return PlayerInventory.maxInventorySize
  }

  /**
   * Called when component is attached to GameObject
   */
  protected onCreate(): void {
    this.initializeStack()
    this.initializeMaxIndicator()
    this.setupAudio()
  }

  /**
   * Initialize the item stack in front of the player
   */
  private initializeStack(): void {
    // Create stack in front of the player
    // Position it in front and at a reasonable height
    const stackPosition = STACK_POSITION.clone()

    this.itemStack = new ItemStack(null as any, stackPosition) // Scene not used in ItemStack constructor
    this.itemStack.setParent(this.gameObject)
    
    // Enable curve-based physics animation
    // Stack bends opposite to movement, springs back to straight when stopped
    this.itemStack.enablePhysics(this.gameObject, {
      maxCurvature: 0.10,         // How much the stack can bend (0 = straight)
      curveResponse: 0.018,       // How fast it responds to movement (slower)
      frequency: 3.5,             // Spring speed for bounce back
      damping: 0.4,               // < 1 = bouncy overshoot (more bounce)
      rotationAmount: 0.6,        // How much items tilt along the curve (more rotation)
      maxRotation: 0.5            // Max tilt ~28 degrees
    })
  }

  /**
   * Setup the audio system for pickup sounds
   */
  private setupAudio(): void {
    this.audioComponent = new Audio2D(["pick up"])
    this.gameObject.addComponent(this.audioComponent)
  }

  /**
   * Get current number of items in inventory
   */
  public getItemCount(): number {
    return this.itemStack ? this.itemStack.getItemCount() : 0
  }

  /**
   * Check if inventory is full
   */
  public isFull(): boolean {
    return this.getItemCount() >= this.maxItems
  }

  /**
   * Check if inventory is empty
   */
  public isEmpty(): boolean {
    return this.getItemCount() === 0
  }

  /**
   * Get all items in the inventory
   */
  public getAllItems(): Item[] {
    return this.itemStack ? this.itemStack.getAllItems() : []
  }

  /**
   * Add an item to the inventory
   * @param item The item to add
   * @returns True if successfully added, false if inventory is full
   */
  public addItem(item: Item): boolean {
    if (this.isFull()) {
      console.warn("Cannot add item: Player inventory is full")
      return false
    }

    // Add to the stack
    this.itemStack.addItem(item)
    this.onItemAdded(item)
    return true
  }

  public addItemAnimated(item: Item): boolean {
    if (this.isFull()) {
      console.warn("Cannot add item: Player inventory is full")
      return false
    }
    // Add to the stack
    this.itemStack.addItemAnimated(item)
    this.onItemAdded(item)
    return true
  }

  private onItemAdded(item: Item) {

    // Only log when getting close to full
    if (this.getItemCount() >= this.maxItems - 1) {
      console.log(
        `🎒 Added ${item.itemType} to player inventory (${this.getItemCount()}/${this.maxItems})`,
      )
    }

    // Update MAX indicator
    this.updateMaxIndicator()

    // Play pickup sound
    if (this.audioComponent) {
      this.audioComponent.play("pick up")
    }
  }

  /**
   * Remove an item from the inventory by type
   * @param itemType The type of item to remove
   * @returns The removed item or null if not found
   */
  public removeItem(itemType: string): Item | null {
    if (!this.itemStack) return null

    // Find and remove the first item of the specified type
    const items = this.itemStack.getAllItems()
    for (let i = items.length - 1; i >= 0; i--) {
      const item = items[i]
      if (item.itemType === itemType) {
        // Remove the item from the stack
        // Note: ItemStack needs a removeItemAtIndex method for this to work properly
        // For now, we'll remove the last item if it matches
        if (i === items.length - 1) {
          const removedItem = this.itemStack.removeLastItem()

          // Update MAX indicator after removing item
          this.updateMaxIndicator()

          return removedItem
        } else {
          console.warn(
            "Cannot remove item from middle of stack - removeItemAtIndex not implemented",
          )
          return null
        }
      }
    }

    return null
  }

  /**
   * Check if inventory contains an item with the given type
   */
  public hasItemOfType(itemType: string): boolean {
    return this.itemStack ? this.itemStack.hasItemOfType(itemType) : false
  }

  /**
   * Get all items of a specific type
   */
  public getItemsOfType(itemType: string): Item[] {
    if (!this.itemStack) return []

    return this.itemStack
      .getAllItems()
      .filter((item) => item.itemType === itemType)
  }

  /**
   * Clear the inventory (remove all items)
   */
  public clear(): void {
    if (!this.itemStack) return

    // Remove all items
    while (this.itemStack.getItemCount() > 0) {
      const item = this.itemStack.removeLastItem()
      if (item) {
        // Properly dispose of the item
        item.getGameObject().removeFromParent()
      }
    }

    // Update MAX indicator after clearing all items
    this.updateMaxIndicator()
  }

  /**
   * Get the item stack for direct access (for debugging or advanced usage)
   */
  public getItemStack(): ItemStack {
    return this.itemStack
  }

  /**
   * Initialize the MAX indicator that appears when inventory is full
   */
  private initializeMaxIndicator(): void {
    this.maxIndicator = new MaxIndicator({
      heightOffset: this.calculateStackHeight() + MAX_INDICATOR_HEIGHT_OFFSET,
    })
    // PlayerInventory MAX indicator initialized
  }

  /**
   * Update the visibility and position of the MAX indicator
   */
  private updateMaxIndicator(): void {
    if (!this.maxIndicator) return

    // Update position to be above the burger stack, not the player
    const stackHeight = this.calculateStackHeight()
    const stackWorldPosition = this.getStackWorldPosition()
    this.maxIndicator.updateHeightOffset(
      stackHeight + MAX_INDICATOR_HEIGHT_OFFSET,
      {
        position: stackWorldPosition,
      },
    )

    // Show/hide based on fullness
    const itemCount = this.getItemCount()
    const isFull = this.isFull()

    if (isFull) {
      this.maxIndicator.show()
      console.log(
        `🔄 PlayerInventory FULL (${itemCount}/${this.maxItems}) - showing MAX above stack`,
      )
    } else {
      this.maxIndicator.hide()
      if (itemCount > 0) {
        // Inventory not full
      }
    }
  }

  /**
   * Get the world position of the burger stack
   */
  private getStackWorldPosition(): THREE.Vector3 {
    const stackWorldPos = new THREE.Vector3()

    // Get player's world position and add the stack offset
    this.gameObject.getWorldPosition(stackWorldPos)

    // Add the local offset of the stack transformed by player rotation
    const stackOffset = STACK_POSITION.clone()
    stackOffset.applyQuaternion(this.gameObject.quaternion)
    stackWorldPos.add(stackOffset)

    return stackWorldPos
  }

  /**
   * Calculate the current height of the item stack
   */
  private calculateStackHeight(): number {
    if (!this.itemStack) return 0

    const items = this.itemStack.getAllItems()
    let totalHeight = 0
    items.forEach((item) => {
      // Assume each burger is about 0.5 units tall
      totalHeight += 0.5
    })
    return totalHeight
  }

  /**
   * Set the camera for world-space UI updates (call this when camera is available)
   */
  public setCameraForUI(camera: THREE.Camera): void {
    // Setting camera for UI updates
    if (this.maxIndicator) {
      this.maxIndicator.attachTo(this.gameObject, camera)
      // MAX indicator attached to camera
    } else {
      console.log("🔄 PlayerInventory: MAX indicator not initialized yet")
    }

    // DEBUG: Add test function for player inventory MAX
    ;(window as any).testPlayerMax = () => {
      console.log("🧪 Testing player MAX indicator...")
      console.log(`Current inventory: ${this.getItemCount()}/${this.maxItems}`)
      console.log(`Is full: ${this.isFull()}`)
      console.log(`MAX indicator exists: ${!!this.maxIndicator}`)

      // Check current state without forcing
      if (this.maxIndicator) {
        console.log(
          `MAX indicator visible: ${this.maxIndicator.getIsVisible()}`,
        )
        // Only force show if actually full
        if (this.isFull()) {
          this.maxIndicator.show()
          console.log("🧪 Inventory is full - showing MAX")
        } else {
          this.maxIndicator.hide()
          console.log("🧪 Inventory not full - hiding MAX")
        }
      }
    }

    // DEBUG: Add function to force hide player MAX
    ;(window as any).hidePlayerMax = () => {
      console.log("🧪 Forcing player MAX to hide...")
      if (this.maxIndicator) {
        this.maxIndicator.hide()
        console.log("🧪 Player MAX hidden")
      }
    }

    // DEBUG: Test create/destroy pattern for player
    ;(window as any).testPlayerCreateDestroy = () => {
      console.log("🧪 Testing player create/destroy pattern...")
      if (this.maxIndicator) {
        console.log("🧪 Player Step 1: DESTROY")
        this.maxIndicator.hide()

        setTimeout(() => {
          console.log("🧪 Player Step 2: CREATE")
          this.maxIndicator.show()

          setTimeout(() => {
            console.log("🧪 Player Step 3: DESTROY again")
            this.maxIndicator.hide()
          }, 2000)
        }, 1000)
      }
    }

    // DEBUG: Test player positioning
    ;(window as any).testPlayerPositioning = () => {
      console.log("🧪 Testing player MAX positioning...")
      console.log("🧪 Player position:", this.gameObject?.position?.clone())

      const playerWorldPos = new THREE.Vector3()
      this.gameObject.getWorldPosition(playerWorldPos)
      console.log("🧪 Player WORLD position:", playerWorldPos)

      const stackWorldPos = this.getStackWorldPosition()
      console.log("🧪 Calculated stack WORLD position:", stackWorldPos)

      if (this.maxIndicator) {
        console.log("🧪 Forcing player MAX to show for position testing...")
        this.maxIndicator.show()
      }
    }

    // Debug functions available
  }

  /**
   * Update method to be called from player component for UI updates
   */
  public updateUI(camera: THREE.Camera): void {
    if (this.maxIndicator) {
      // Use stack world position instead of player position
      const stackWorldPosition = this.getStackWorldPosition()
      this.maxIndicator.update({ position: stackWorldPosition }, camera)
      if (this.isFull()) this.updateMaxIndicator()
    }
  }

  /**
   * Component cleanup
   */
  protected onCleanup(): void {
    if (this.maxIndicator) {
      this.maxIndicator.dispose()
    }
    this.clear()
    super.onCleanup()
  }
}
