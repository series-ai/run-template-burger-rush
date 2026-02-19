import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { CameraManager, CameraMode } from "../camera"
import { UnlockManager, IUnlockable } from "@game/money"
import { PlayerComponent } from "@game"

/**
 * System that highlights newly unlocked items using the existing camera system
 * Temporarily switches to free camera mode and moves to showcase unlocks
 */
export class UnlockHighlightSystem extends Component {
  // Static flag to enable/disable camera highlights globally
  public static enabled: boolean = true
  
  private cameraManager: CameraManager | null = null
  private player: GameObject | null = null
  private isHighlighting: boolean = false
  private originalCameraMode: CameraMode = CameraMode.FOLLOW
  
  // Timing state
  private highlightTimer: number = 0
  private currentPhase: 'waiting' | 'moving' | 'holding' | 'returning' | 'done' = 'done'
  private targetItem: any = null
  private tempTarget: GameObject | null = null
  private startPosition: THREE.Vector3 = new THREE.Vector3()
  private targetPosition: THREE.Vector3 = new THREE.Vector3()
  
  // Simple queue for multiple unlocks
  private unlockQueue: any[] = []
  
  // Timing settings
  private readonly INITIAL_DELAY = 0.3 // Seconds to wait before starting camera movement
  private readonly TRANSITION_DURATION = 0.1 // Seconds to move camera
  private readonly HOLD_DURATION = 1.5 // Seconds to hold at target

  /**
   * Initialize the unlock highlight system
   */
  public initialize(cameraManager: CameraManager, player: GameObject): void {
    this.cameraManager = cameraManager
    this.player = player
    
    // Register for unlock events
    this.setupUnlockListeners()
    
    console.log("🎬 Unlock highlight system initialized")
  }

  protected onCreate(): void {
    // Component created - wait for initialize() call
  }

  /**
   * Setup listeners for unlock events from UnlockManager
   */
  private setupUnlockListeners(): void {
    // Create bound listener function for easy removal later
    const listener = this.onItemAcquired.bind(this)
    
    // Register with UnlockManager to be notified of acquisitions
    UnlockManager.addAcquireListener(listener)
  }

  /**
   * Handle when an item is acquired and check for newly unlocked items
   * This is called by the UnlockManager event listener
   */
  public onItemAcquired(acquiredItem: any, newlyUnlocked: any[]): void {
    // Skip if highlighting is disabled
    if (!UnlockHighlightSystem.enabled) {
      console.log(`🎬 Unlock highlight disabled - skipping ${newlyUnlocked.length} items`)
      return
    }
    
    if (newlyUnlocked.length === 0) return

    console.log(`🎬 Queueing ${newlyUnlocked.length} newly unlocked items`)
    
    // Add items to queue in order received (no priority sorting)
    this.unlockQueue.push(...newlyUnlocked)

    // Start highlighting if not already doing so
    this.processQueue()
  }

  /**
   * Process the unlock queue - highlight the next item if not currently highlighting
   */
  private processQueue(): void {
    if (this.isHighlighting || this.unlockQueue.length === 0) {
      return // Already highlighting or queue empty
    }

    const nextItem = this.unlockQueue.shift()! // Remove and get first item
    console.log(`🎬 Starting highlight for: ${nextItem.getUnlockableId ? nextItem.getUnlockableId() : 'unknown'}`)
    console.log(`🎬 Remaining in queue: ${this.unlockQueue.length}`)
    
    this.highlightUnlock(nextItem)
  }


  /**
   * Get position for unlockable item - simple and clean
   */
  private getUnlockablePosition(targetItem: any, outPosition: THREE.Vector3): void {
    // Check if the unlockable has a custom highlight position method
    if (targetItem.getHighlightPosition) {
      targetItem.getHighlightPosition(outPosition)
      return
    }

    // Otherwise, use the GameObject's world position
    const gameObject = targetItem.gameObject || targetItem.getGameObject?.()
    
    if (!gameObject) {
      console.warn("🎬 No gameObject found for unlock item")
      outPosition.set(0, 0, 0)
      return
    }

    gameObject.getWorldPosition(outPosition)
  }

  /**
   * Start the highlight sequence for a newly unlocked item using follow camera
   */
  private highlightUnlock(targetItem: any): void {
    if (!this.cameraManager || !this.player || this.isHighlighting) {
      return
    }

    console.log("🎬 Starting unlock highlight for:", targetItem.getDisplayName?.() || "unknown item")

    this.isHighlighting = true
    this.targetItem = targetItem
    this.highlightTimer = 0
    this.currentPhase = 'waiting'

    // Store original camera mode
    this.originalCameraMode = this.cameraManager.getCameraMode()

    // Store positions for later use when we start moving
    if (this.player) {
      this.player.getWorldPosition(this.startPosition)
      this.getUnlockablePosition(targetItem, this.targetPosition)
    }
    
    console.log("🎬 Waiting before camera movement...")
  }

  /**
   * Update method - handles unlock highlighting state machine
   */
  public update(deltaTime: number): void {
    if (!this.isHighlighting) return

    this.highlightTimer += deltaTime

    switch (this.currentPhase) {
      case 'waiting':
        // Wait for initial delay before starting camera movement
        if (this.highlightTimer >= this.INITIAL_DELAY) {
          this.currentPhase = 'moving'
          this.highlightTimer = 0
          
          // Now set up the camera target for movement
          if (this.cameraManager && this.player) {
            this.cameraManager.setCameraMode(CameraMode.FOLLOW)
            
            const tempTarget = this.createTemporaryTarget(this.targetItem)
            if (tempTarget) {
              tempTarget.position.copy(this.startPosition)
              this.cameraManager.setTarget(tempTarget)
              console.log("🎬 Starting camera movement to unlock")
            }
          }
        }
        break

      case 'moving':
        if (!this.tempTarget) return
        
        // Smoothly animate temp target from player to unlock position
        const moveProgress = Math.min(this.highlightTimer / this.TRANSITION_DURATION, 1)
        const smoothProgress = this.easeOutQuad(moveProgress)
        
        this.tempTarget.position.lerpVectors(this.startPosition, this.targetPosition, smoothProgress)
        
        if (moveProgress >= 1) {
          this.currentPhase = 'holding'
          this.highlightTimer = 0
          console.log("🎬 Camera reached target - holding position")
        }
        break

      case 'holding':
        if (this.highlightTimer >= this.HOLD_DURATION) {
          this.currentPhase = 'returning'
          this.highlightTimer = 0
          
          console.log("🎬 Returning camera to player")
        }
        break

      case 'returning':
        // Check if more items in queue - if so, transition directly to next
        if (this.unlockQueue.length > 0) {
          // Start next item directly - no return to player
          const nextItem = this.unlockQueue.shift()!
          console.log(`🎬 Transitioning to next unlock: ${nextItem.getUnlockableId ? nextItem.getUnlockableId() : 'unknown'}`)
          
          // Clean up current temp target
          if (this.tempTarget) {
            this.tempTarget.dispose()
            this.tempTarget = null
          }
          
          // Set up next item with waiting phase
          this.targetItem = nextItem
          this.highlightTimer = 0
          this.currentPhase = 'waiting'
          
          // Set up positions for smooth transition from current to next unlock
          this.startPosition.copy(this.targetPosition) // Start from where we just were
          this.getUnlockablePosition(nextItem, this.targetPosition) // Move to next unlock
          
          console.log("🎬 Waiting before next camera movement...")
        } else {
          // No more items - give control back to player
          this.currentPhase = 'done'
          this.finishHighlight()
          console.log("🎬 All unlock highlights complete")
        }
        break
    }
  }

  /**
   * Smoother easing - starts at normal speed, slows down as it approaches
   */
  private easeOutQuad(t: number): number {
    return 1 - (1 - t) * (1 - t)
  }

  /**
   * Create a temporary GameObject target for camera following
   */
  private createTemporaryTarget(targetItem: any): GameObject | null {
    // Get target world position
    const targetPosition = new THREE.Vector3()
    if (targetItem.gameObject?.getWorldPosition) {
      targetItem.gameObject.getWorldPosition(targetPosition)
    } else if (targetItem.getGameObject?.()?.getWorldPosition) {
      targetItem.getGameObject().getWorldPosition(targetPosition)
    } else {
      return null
    }

    // Create temporary target GameObject for camera to follow
    const tempTarget = new GameObject("UnlockHighlightTarget")
    tempTarget.position.copy(targetPosition)
    
    // Store reference for cleanup
    this.tempTarget = tempTarget
    
    return tempTarget
  }

  /**
   * Return camera to player using follow camera mode
   */
  private returnToPlayer(): void {
    if (!this.cameraManager || !this.player) return

    // Switch back to original camera mode 
    this.cameraManager.setCameraMode(this.originalCameraMode)
    
    // Use smooth target change to avoid jump
    this.cameraManager.setTargetSmooth(this.player)
  }


  /**
   * Finish entire highlight sequence and return control to player
   */
  private finishHighlight(): void {
    // Switch back to following player
    this.returnToPlayer()
    
    // Clean up temporary target
    if (this.tempTarget) {
      this.tempTarget.dispose()
      this.tempTarget = null
    }

    // Reset all state
    this.isHighlighting = false
    this.targetItem = null
    this.highlightTimer = 0
    this.currentPhase = 'done'
  }


  /**
   * Check if currently highlighting an unlock
   */
  public isCurrentlyHighlighting(): boolean {
    return this.isHighlighting
  }

  /**
   * Force stop highlighting (for emergency/debug purposes)
   */
  public stopHighlighting(): void {
    if (this.isHighlighting) {
      this.finishHighlight()
      this.returnToPlayer()
    }
  }

  /**
   * Get debug info
   */
  public getDebugInfo(): any {
    return {
      isHighlighting: this.isHighlighting,
      currentPhase: this.currentPhase,
      timer: this.highlightTimer,
      hasCameraManager: !!this.cameraManager,
      hasPlayer: !!this.player,
      originalMode: this.originalCameraMode,
      targetItem: this.targetItem?.getDisplayName?.() || null
    }
  }
}