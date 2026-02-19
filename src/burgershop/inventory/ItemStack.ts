import * as THREE from "three"
import { GameObject } from "@series-inc/rundot-3d-engine"
import { Item } from "./Item"
import { TweenSystem, Easing } from "@series-inc/rundot-3d-engine/systems"
import { ItemStackPhysics } from "./ItemStackPhysics"

export type ItemPair = [Item, GameObject | null]

/**
 * Class that manages stacking items visually in Three.js
 */
export class ItemStack {
  private items: ItemPair[] = []
  private stackContainer: GameObject
  private stackOffset: THREE.Vector3 = new THREE.Vector3(0, 0, 0)
  private stackPhysics: ItemStackPhysics | null = null
  private physicsEnabled: boolean = false

  /**
   * Create a new ItemStackThree
   * @param scene The Three.js scene (not used directly but kept for compatibility)
   * @param position Initial position of the stack
   */
  constructor(scene: THREE.Scene, position: THREE.Vector3) {
    this.stackContainer = new GameObject("itemStack")
    this.stackContainer.position.copy(position)
  }

  /**
   * Add an item to the top of the stack
   * @param item The item to add
   */
  addItem(item: Item): void {
    // Calculate position based on heights of existing items
    const height = this.calculateStackHeight()
    item.setParent(this.stackContainer)
    // Set position - dynamic objects will auto-update in GPU batches
    item.setPosition(new THREE.Vector3(0, height, 0))
    item.setRotation(new THREE.Euler(0, 0, 0))
    this.items.push([item, null])
    
    // Add springy scale-in animation for game juice
    this.addScaleInAnimation(item)
    
    // Update physics if enabled
    if (this.stackPhysics) {
      this.stackPhysics.updateItems(this.items)
    }
  }

  addItemAnimated(item: Item): void {
    // Calculate position based on heights of existing items
    const height = this.calculateStackHeight()
    const positionTarget = new GameObject("itemPositionTarget")
    this.stackContainer.add(positionTarget)
    positionTarget.position.copy(this.stackPhysics ? this.stackPhysics!.getCurvedPosition(1) : new THREE.Vector3(0, height, 0))

    item.animateToPosition(positionTarget, () => {
      const itemWorldPosition = new THREE.Vector3()
      item.getGameObject()?.getWorldPosition(itemWorldPosition)
      item.setParent(this.stackContainer)

      item.setPosition(this.stackContainer.worldToLocal(itemWorldPosition))
      item.setRotation(new THREE.Euler(0, 0, 0))

      for (const itemPair of this.items) {
        if (itemPair[0] === item && itemPair[1] !== null) {
          itemPair[1]?.removeFromParent()
          itemPair[1]?.dispose()
          itemPair[1] = null
        }
      }
    })

    this.items.push([item, positionTarget])
    if (this.stackPhysics) {
      this.stackPhysics.updateItems(this.items)
    }
    this.rearrangeStack()
  }

  /**
   * Add a springy scale-in animation to an item when it's placed
   */
  private addScaleInAnimation(item: Item): void {
    const itemGameObject = item.getGameObject()
    if (!itemGameObject) {
      return
    }

    // Start small and spring up to normal size
    const originalScale = 1.0
    const startScale = 0.5 // Less dramatic start
    const springDuration = 0.3 // Faster

    // Set initial small scale
    itemGameObject.scale.setScalar(startScale)

    // Spring up to normal size with gentle bounce
    const scaleUpTween = TweenSystem.tween(
      itemGameObject.scale,
      'x',
      originalScale,
      springDuration,
      (t: number) => Easing.spring(t, 2.5, 1.2) // More subtle spring
    )

    // Also animate Y and Z scales
    TweenSystem.tween(
      itemGameObject.scale,
      'y',
      originalScale,
      springDuration,
      (t: number) => Easing.spring(t, 2.5, 1.2)
    )

    TweenSystem.tween(
      itemGameObject.scale,
      'z',
      originalScale,
      springDuration,
      (t: number) => Easing.spring(t, 2.5, 1.2)
    )

    scaleUpTween.onCompleted(() => {
      // Ensure we're exactly at 1.0 (fix any floating point errors)
      itemGameObject.scale.setScalar(originalScale)
    })
  }

  /**
   * Remove and return the last item from the stack
   */
  removeLastItem(): Item | null {
    if (this.items.length === 0) return null
    const item = this.items.pop()!
    this.rearrangeStack()
    
    // Update physics if enabled
    if (this.stackPhysics) {
      this.stackPhysics.updateItems(this.items)
    }
    
    return item[0]
  }

  /**
   * Get the last item without removing it
   */
  getLastItem(): Item | null {
    if (this.items.length === 0) return null
    return this.items[this.items.length - 1][0]
  }

  /**
   * Get an item at a specific index without removing it
   * @param index The index of the item to retrieve
   */
  getItemAtIndex(index: number): Item | null {
    if (index < 0 || index >= this.items.length) return null
    return this.items[index][0]
  }

  /**
   * Get all items in the stack
   */
  getAllItems(): Item[] {
    return this.items.map((item) => item[0])
  }

  /**
   * Get the number of items in the stack
   */
  getItemCount(): number {
    return this.items.length
  }

  /**
   * Check if the stack has any items of a specific type
   */
  hasItemOfType(itemType: string): boolean {
    return this.items.some((item) => item[0].itemType === itemType)
  }

  /**
   * Get all items of a specific type
   */
  getItemsOfType(itemType: string): Item[] {
    return this.items.filter((item) => item[0].itemType === itemType).map((item) => item[0])
  }

  /**
   * Remove an item of a specific type from the stack if available
   */
  removeItemOfType(itemType: string): Item | null {
    // Find the index of an item of the requested type
    const index = this.items.findIndex((item) => item[0].itemType === itemType)
    if (index === -1) return null

    // Remove and return the item
    const item = this.items.splice(index, 1)[0]
    this.rearrangeStack()
    
    // Update physics if enabled
    if (this.stackPhysics) {
      this.stackPhysics.updateItems(this.items)
    }
    
    return item[0]
  }

  /**
   * Check if the stack is empty
   */
  isEmpty(): boolean {
    return this.items.length === 0
  }

  /**
   * Check if the stack contains a maximum number of items
   */
  isFull(maxItems: number): boolean {
    return this.items.length >= maxItems
  }

  /**
   * Set parent of the stack
   */
  setParent(parent: GameObject): void {
    parent.add(this.stackContainer)
  }

  /**
   * Get the container GameObject of the stack
   */
  getContainer(): GameObject {
    return this.stackContainer
  }

  /**
   * Calculate the total height of the stack
   */
  private calculateStackHeight(): number {
    let totalHeight = 0
    this.items.forEach((item) => {
      totalHeight += item[0].getDimensions().y
    })

    return totalHeight
  }

  /**
   * Rearrange all items in the stack
   */
  private rearrangeStack(): void {
    // Reposition all items when one is removed
    let currentHeight = 0
    this.items.forEach((item) => {
      if (item[1]) {
        item[1].position.copy(new THREE.Vector3(0, currentHeight, 0))
      }
      else {
        item[0].setPosition(new THREE.Vector3(0, currentHeight, 0))
      }

      currentHeight += item[0].getDimensions().y
    })
  }

  /**
   * Enable physics-based animation for the stack
   * @param parentGameObject The parent GameObject that the stack follows (e.g., the player)
   * @param params Optional parameters for tuning the physics
   */
  enablePhysics(
    parentGameObject: GameObject,
    params?: {
      maxCurvature?: number      // Maximum bend amount (0.1-0.3 typical)
      curveResponse?: number     // How fast curve responds to velocity
      frequency?: number         // Spring frequency for bounce back
      damping?: number           // Spring damping (< 1 = bouncy)
      rotationAmount?: number    // How much items rotate along curve
      maxRotation?: number       // Max rotation in radians
    }
  ): void {
    if (!this.stackPhysics) {
      this.stackPhysics = new ItemStackPhysics()
      parentGameObject.addComponent(this.stackPhysics)
      
      // Apply custom parameters if provided
      if (params) {
        this.stackPhysics.setParameters(params)
      }
      
      // Pass the stack container and current items
      this.stackPhysics.setStackContainer(this.stackContainer)
      this.stackPhysics.updateItems(this.items)
      this.physicsEnabled = true
    }
  }

  /**
   * Disable physics-based animation
   */
  disablePhysics(): void {
    if (this.stackPhysics) {
      // Reset items to their base positions
      this.rearrangeStack()
      
      // The physics component will clean itself up when the parent is destroyed
      // We just need to clear our reference
      this.stackPhysics = null
      this.physicsEnabled = false
    }
  }

  /**
   * Reset physics to neutral state (useful when teleporting)
   */
  resetPhysics(): void {
    if (this.stackPhysics) {
      this.stackPhysics.reset()
    }
  }

  /**
   * Dispose of the stack and all items in it
   */
  dispose(): void {
    // Remove all items from the scene
    this.items.forEach((item) => {
      // Remove item from its parent (the stack container)

      this.stackContainer.remove(item[0].getGameObject())

      if (item[1]) {
        this.stackContainer.remove(item[1])
      }
    })
    this.items = []

    // Remove the stack container from its parent if it has one
    if (this.stackContainer.parent) {
      this.stackContainer.parent.remove(this.stackContainer)
    }
  }
}
