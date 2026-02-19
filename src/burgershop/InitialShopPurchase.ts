import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import {
  PurchaseArea,
  UnlockManager,
  IUnlockable,
  CostManager,
} from "@game/money"
import {
  RigidBodyComponentThree,
  RigidBodyType,
  ColliderShape,
  PrefabLoader,
  StowKitSystem,
  ParticleSystemPrefabComponent,
  PlayAudioOneShot2D,
  Main2DAudioBank,
  TweenSystem,
  Easing,
} from "@series-inc/rundot-3d-engine/systems"
import { BurgerShopDirectory } from "./BurgerShopDirectory"
import { AnimationUtils } from "./shared/AnimationUtils"
import { PlayerComponent } from "./PlayerComponent"
import { CameraManager } from "./camera/CameraManager"

/**
 * Component that keeps a GameObject positioned in front of the camera
 */
class CameraFollowEffect extends Component {
  private cameraManager: CameraManager
  private distance: number
  private forward = new THREE.Vector3()

  constructor(cameraManager: CameraManager, distance: number) {
    super()
    this.cameraManager = cameraManager
    this.distance = distance
  }

  public update(_deltaTime: number): void {
    const cameraState = this.cameraManager.getDebugCameraState()
    if (!cameraState) return

    this.forward.set(0, 0, -1)
    this.forward.applyQuaternion(cameraState.quaternion)
    
    this.gameObject.position.copy(cameraState.position)
    this.gameObject.position.addScaledVector(this.forward, this.distance)
  }
}

/**
 * Initial shop purchase component that blocks player access initially
 * Serves as the first purchase to "buy the burger shop"
 * When acquired, removes the entrance barrier to allow access
 */
export class InitialShopPurchase extends Component implements IUnlockable {
  private entranceBlocker!: GameObject // Child GameObject containing mesh and physics
  private barrierPhysics!: RigidBodyComponentThree // Direct reference to physics component
  private exteriorObject!: GameObject // Store exterior visual
  
  // Purchase system
  private purchaseArea!: PurchaseArea
  private purchaseAreaObject!: GameObject
  
  // Title screen support - keeps exterior visible until title screen ends
  private pendingExteriorAnimateOut: boolean = false

  // Cutscene settings
  private static readonly CUTSCENE_CAMERA_TRANSITION_DURATION = 0.8 // seconds to move camera to viewing position
  private static readonly CUTSCENE_PARTICLE_DELAY = 0.6 // seconds to wait after particles before animate out
  private static readonly CUTSCENE_WATCH_DURATION = 0.6 // seconds to watch the shop transition after animate out
  private static readonly CUTSCENE_RETURN_DURATION = 0.7 // seconds to return camera to follow

  constructor() {
    super()
  }

  protected onCreate(): void {
    this.createEntranceBarrier()
    this.createExterior()
    this.setupPurchaseArea()
  }

  // Stagger delay between each particle effect (in milliseconds)
  private static readonly PARTICLE_STAGGER_DELAY = 150
  // Delay between whistle sound and explosion (in milliseconds)
  private static readonly WHISTLE_TO_EXPLOSION_DELAY = 400

  /**
   * Trigger cutscene particle effects at all particle slots
   */
  private triggerCutsceneParticles(): void {
    const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
    const unlockPrefab = prefabCollection.getPrefabByName("pfx_intro_unlock")

    if (!unlockPrefab) {
      console.warn("pfx_intro_unlock prefab not found")
      return
    }

    // Find particle slots under the exterior object
    const particleSlots = this.findParticleSlots()
    
    if (particleSlots.length === 0) {
      console.warn("No particle slots found under restaurant_exterior")
      return
    }

    // Spawn sunshine effect when first whistle plays
    this.spawnSunshineEffect()

    // Spawn particles at each slot with staggered playback
    particleSlots.forEach((slot, index) => {
      setTimeout(() => {
        this.spawnParticleAtSlot(unlockPrefab, slot)
      }, index * InitialShopPurchase.PARTICLE_STAGGER_DELAY)
    })
  }

  /**
   * Find all particle_slot objects under the exterior prefab
   */
  private findParticleSlots(): THREE.Object3D[] {
    if (!this.exteriorObject) {
      return []
    }

    const slots: THREE.Object3D[] = []
    
    // Search for particle_slot_01 through particle_slot_04
    for (let i = 1; i <= 4; i++) {
      const slotName = `particle_slot_0${i}`
      const slot = this.exteriorObject.getObjectByName(slotName)
      if (slot) {
        slots.push(slot)
      }
    }

    return slots
  }

  /**
   * Spawn a particle effect at a specific slot position with sound effects
   */
  private spawnParticleAtSlot(unlockPrefab: any, slot: THREE.Object3D): void {
    // Play whistle sound first
    try {
      PlayAudioOneShot2D(Main2DAudioBank, "firework_whistle")
    } catch (error) {
      console.warn("Failed to play firework_whistle sound:", error)
    }

    // After whistle delay, spawn particle and play explosion
    setTimeout(() => {
      // Get world position of the slot
      const worldPos = new THREE.Vector3()
      slot.getWorldPosition(worldPos)

      // Create holder at slot's world position
      const effectHolder = new GameObject("IntroUnlockEffect")
      effectHolder.position.copy(worldPos)

      // Instantiate the prefab
      const instance = PrefabLoader.instantiatePrefab(unlockPrefab, effectHolder)
      const particleComponent = instance.gameObject.getComponent(ParticleSystemPrefabComponent)

      if (particleComponent) {
        // Play explosion sound when particle fires
        try {
          PlayAudioOneShot2D(Main2DAudioBank, "firework_explosion")
        } catch (error) {
          console.warn("Failed to play firework_explosion sound:", error)
        }

        particleComponent.play()

        // Clean up after 5 seconds
        setTimeout(() => {
          effectHolder.dispose()
        }, 5000)
      } else {
        effectHolder.dispose()
      }
    }, InitialShopPurchase.WHISTLE_TO_EXPLOSION_DELAY)
  }

  /**
   * Spawn sunshine screen-space effect in front of camera, following camera each frame
   */
  private spawnSunshineEffect(): void {
    const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
    const sunshinePrefab = prefabCollection.getPrefabByName("pfx_sunshine")

    if (!sunshinePrefab) {
      console.warn("pfx_sunshine prefab not found")
      return
    }

    const cameraManager = BurgerShopDirectory.getCameraManager()
    if (!cameraManager) {
      console.warn("CameraManager not found for sunshine effect")
      return
    }

    // Get initial camera state
    const cameraState = cameraManager.getDebugCameraState()
    if (!cameraState) {
      console.warn("Could not get camera state for sunshine effect")
      return
    }

    // Calculate initial position 3 meters in front of camera
    const forward = new THREE.Vector3(0, 0, -1)
    forward.applyQuaternion(cameraState.quaternion)
    const spawnPos = cameraState.position.clone().add(forward.multiplyScalar(3))

    // Create holder at spawn position
    const effectHolder = new GameObject("SunshineEffect")
    effectHolder.position.copy(spawnPos)

    // Add component to follow camera
    const followComponent = new CameraFollowEffect(cameraManager, 3)
    effectHolder.addComponent(followComponent)

    // Instantiate the prefab
    const instance = PrefabLoader.instantiatePrefab(sunshinePrefab, effectHolder)
    const particleComponent = instance.gameObject.getComponent(ParticleSystemPrefabComponent)

    if (particleComponent) {
      particleComponent.play()

      // Clean up after 5 seconds
      setTimeout(() => {
        effectHolder.dispose()
      }, 5000)
    } else {
      effectHolder.dispose()
    }
  }

  // Door swing animation settings
  private static readonly DOOR_SWING_ANGLE = Math.PI / 2 // 90 degrees
  private static readonly DOOR_SWING_DURATION = 0.5 // seconds

  /**
   * Animate doors swinging outward
   */
  private animateDoorsOpen(onComplete?: () => void): void {
    if (!this.exteriorObject) {
      onComplete?.()
      return
    }

    // Find door objects
    const leftDoor = this.exteriorObject.getObjectByName("restaurant_display_base_doorl")
    const rightDoor = this.exteriorObject.getObjectByName("restaurant_display_base_doorr")

    if (!leftDoor && !rightDoor) {
      console.warn("Door objects not found in exterior")
      onComplete?.()
      return
    }

    let animationsRemaining = 0

    const checkComplete = () => {
      animationsRemaining--
      if (animationsRemaining <= 0 && onComplete) {
        onComplete()
      }
    }

    // Animate left door (swing outward - negative Y rotation)
    if (leftDoor) {
      animationsRemaining++
      const leftTarget = leftDoor.rotation.y - InitialShopPurchase.DOOR_SWING_ANGLE
      const leftTween = TweenSystem.tween(
        leftDoor.rotation,
        "y",
        leftTarget,
        InitialShopPurchase.DOOR_SWING_DURATION,
        (t: number) => Easing.easeOutBack(t)
      )
      leftTween.onCompleted(checkComplete)
    }

    // Animate right door (swing outward - positive Y rotation)
    if (rightDoor) {
      animationsRemaining++
      const rightTarget = rightDoor.rotation.y + InitialShopPurchase.DOOR_SWING_ANGLE
      const rightTween = TweenSystem.tween(
        rightDoor.rotation,
        "y",
        rightTarget,
        InitialShopPurchase.DOOR_SWING_DURATION,
        (t: number) => Easing.easeOutBack(t)
      )
      rightTween.onCompleted(checkComplete)
    }

    // If no doors found to animate, complete immediately
    if (animationsRemaining === 0 && onComplete) {
      onComplete()
    }
  }

  // ============================================

  /**
   * Create the exterior visual that shows before shop is purchased
   */
  private createExterior(): void {
    const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
    const exteriorPrefab = prefabCollection.getPrefabByName("restaurant_exterior")
    if (exteriorPrefab) {
      const instance = PrefabLoader.instantiatePrefab(exteriorPrefab, this.gameObject)
      this.exteriorObject = instance.gameObject
    } else {
      console.warn("restaurant_exterior prefab not found")
      this.exteriorObject = new GameObject("Exterior")
      this.gameObject.add(this.exteriorObject)
    }
  }

  /**
   * Create the physical barrier that blocks the player
   */
  private createEntranceBarrier(): void {
    // Create child GameObject for the blocker
    this.entranceBlocker = new GameObject("EntranceBlocker")
    this.gameObject.add(this.entranceBlocker)

    // Create separate GameObject for physics collider at the entrance position
    const colliderObject = new GameObject("DoorCollider")
    colliderObject.position.set(-1, 0, -15)
    this.gameObject.add(colliderObject)

    // Add physics collider to block the player
    this.barrierPhysics = new RigidBodyComponentThree({
      type: RigidBodyType.STATIC,
      shape: ColliderShape.BOX,
      size: new THREE.Vector3(5, 3.5, 1),
      mass: 0,
      restitution: 0.1,
      friction: 0.8,
      isSensor: false,
    })
    colliderObject.addComponent(this.barrierPhysics)
  }

  /**
   * Setup the purchase area for buying the shop
   */
  private setupPurchaseArea(): void {
    // Create purchase area GameObject
    this.purchaseAreaObject = new GameObject("ShopPurchaseArea")
    this.gameObject.add(this.purchaseAreaObject)
    this.purchaseAreaObject.position.set(-1, 0, -20) // Keep at local position (entrance location)

    // Create purchase area component
    this.purchaseArea = new PurchaseArea(
      CostManager.getCost("initial_shop"),
      new THREE.Vector2(8, 4), // 8x4 area (width x depth) - larger for visibility
      "Burger Shop", // Label for the initial purchase
      () => this.onPurchaseComplete() // Start cutscene, then acquire when done
    )
    this.purchaseAreaObject.addComponent(this.purchaseArea)

    // Purchase area starts disabled - will be enabled when unlocked
    this.purchaseAreaObject.setEnabled(false)
  }

  /**
   * Called when purchase is completed - plays cutscene then acquires
   */
  private onPurchaseComplete(): void {
    // Dispose purchase area immediately so player can't re-trigger
    if (this.purchaseAreaObject) {
      this.purchaseAreaObject.dispose()
      this.purchaseAreaObject = null!
    }

    // Disable physics immediately so player can enter
    if (this.barrierPhysics) {
      this.barrierPhysics.setEnabled(false)
      this.barrierPhysics = null!
    }

    // Play cutscene - acquire will be called when cutscene completes
    this.playCutscene()
  }

  // IUnlockable implementation

  /**
   * Called when this item becomes available for purchase
   */
  public unlock(): void {
    // Enable the purchase area so player can buy it
    if (this.purchaseAreaObject) {
      this.purchaseAreaObject.setEnabled(true)
    }
    
    // Barrier stays blocking until purchased
  }

  /**
   * Called when this item has been acquired (purchased)
   * @param fromStorage If true, this is being restored from save (not a fresh purchase)
   */
  public acquire(fromStorage: boolean = false): void {
    // Record shop purchase for tutorial tracking
    const tutorialSystem = BurgerShopDirectory.getTutorialSystem()
    if (tutorialSystem) {
      tutorialSystem.getTracker().recordShopPurchased()
    }

    if (fromStorage) {
      // Restoring from storage - clean up without animation
      // Dispose purchase area if it exists
      if (this.purchaseAreaObject) {
        this.purchaseAreaObject.dispose()
        this.purchaseAreaObject = null!
      }

      // Disable physics
      if (this.barrierPhysics) {
        this.barrierPhysics.setEnabled(false)
        this.barrierPhysics = null!
      }

      // Keep exterior visible for title screen - dispose entrance blocker only
      this.disposeEntranceBlocker()
      // Mark exterior for later animation (will be triggered by title screen)
      this.pendingExteriorAnimateOut = true
    }
    // For fresh purchases, everything is already handled by onPurchaseComplete/playCutscene
    // This is just called to register the acquisition with UnlockManager
  }

  /**
   * Play the shop purchase cutscene:
   * 1. Disable player movement
   * 2. Move camera to viewing position
   * 3. Animate out the shop exterior
   * 4. Wait for animation
   * 5. Return camera to follow mode
   * 6. Re-enable player movement
   * 7. Register acquisition with UnlockManager
   */
  private playCutscene(): void {
    const cameraManager = BurgerShopDirectory.getCameraManager()
    const player = BurgerShopDirectory.getPlayer()
    
    if (!cameraManager || !player) {
      // Fallback to simple animation if camera/player not available
      this.animateOutWithoutCutscene()
      return
    }

    // Get PlayerComponent to disable movement
    const playerComponent = player.getComponent(PlayerComponent)
    if (playerComponent) {
      playerComponent.setMovementEnabled(false)
    }

    // Calculate camera position to view the shop
    // Position the camera to look at the shop entrance from a good angle
    const cameraPosition = new THREE.Vector3(-0, 22, -58)
    const lookAtPosition = new THREE.Vector3(-0, 0, -1)

    // Capture camera to viewing position
    cameraManager.captureCameraLookAt(
      cameraPosition,
      lookAtPosition,
      InitialShopPurchase.CUTSCENE_CAMERA_TRANSITION_DURATION,
      () => {
        // Swing doors open immediately when camera arrives
        this.animateDoorsOpen()

        setTimeout(() => {
          // Camera is in position - trigger particle effects
          this.triggerCutsceneParticles()
        }, 500)

        // Wait for particles, then animate out the shop (add 500ms for sound delay)
        setTimeout(() => {
          // Play initial unlock sound when animation starts
          try {
            PlayAudioOneShot2D(Main2DAudioBank, "initial_unlock")
          } catch (error) {
            console.warn("Failed to play initial_unlock sound:", error)
          }

          this.animateOutShop(() => {
            // Wait a moment to watch the result
            setTimeout(() => {
              // Return camera to follow mode
              cameraManager.releaseCamera(
                InitialShopPurchase.CUTSCENE_RETURN_DURATION,
                () => {
                  // Re-enable player movement
                  if (playerComponent) {
                    playerComponent.setMovementEnabled(true)
                  }

                  // Now register the acquisition with UnlockManager
                  // This will trigger unlock of next items and notify other systems
                  UnlockManager.acquire(this)
                }
              )
            }, InitialShopPurchase.CUTSCENE_WATCH_DURATION * 1000)
          })
        }, 500 + InitialShopPurchase.CUTSCENE_PARTICLE_DELAY * 1000)
      }
    )
  }

  /**
   * Animate out the shop entrance and exterior
   */
  private animateOutShop(onComplete?: () => void): void {
    let animationsRemaining = 0
    
    const checkComplete = () => {
      animationsRemaining--
      if (animationsRemaining <= 0 && onComplete) {
        onComplete()
      }
    }

    if (this.entranceBlocker) {
      animationsRemaining++
      AnimationUtils.animateOut(this.entranceBlocker, () => {
        this.disposeEntranceBlocker()
        checkComplete()
      })
    }
    
    if (this.exteriorObject) {
      animationsRemaining++
      AnimationUtils.animateOut(this.exteriorObject, () => {
        this.disposeExterior()
        checkComplete()
      })
    }

    // If nothing to animate, call complete immediately
    if (animationsRemaining === 0 && onComplete) {
      onComplete()
    }
  }

  /**
   * Fallback animation without cutscene (if camera/player not available)
   */
  private animateOutWithoutCutscene(): void {
    let animationsRemaining = 0
    
    const checkComplete = () => {
      animationsRemaining--
      if (animationsRemaining <= 0) {
        // Register acquisition when animations are done
        UnlockManager.acquire(this)
      }
    }

    if (this.entranceBlocker) {
      animationsRemaining++
      AnimationUtils.animateOut(this.entranceBlocker, () => {
        this.disposeEntranceBlocker()
        checkComplete()
      })
    }
    if (this.exteriorObject) {
      animationsRemaining++
      AnimationUtils.animateOut(this.exteriorObject, () => {
        this.disposeExterior()
        checkComplete()
      })
    }

    // If nothing to animate, acquire immediately
    if (animationsRemaining === 0) {
      UnlockManager.acquire(this)
    }
  }
  
  /**
   * Animate out the exterior after title screen ends.
   * Called by TitleScreen when user clicks to continue.
   */
  public animateOutExterior(): void {
    if (this.pendingExteriorAnimateOut && this.exteriorObject) {
      this.pendingExteriorAnimateOut = false
      AnimationUtils.animateOut(this.exteriorObject, () => {
        this.disposeExterior()
      })
    }
  }
  
  /**
   * Check if exterior is pending animate out (for title screen)
   */
  public hasPendingExteriorAnimation(): boolean {
    return this.pendingExteriorAnimateOut
  }

  private disposeEntranceBlocker(): void {
    if (this.entranceBlocker) {
      this.entranceBlocker.setEnabled(false)
      this.entranceBlocker.dispose()
      this.entranceBlocker = null!
    }
  }

  private disposeExterior(): void {
    if (this.exteriorObject) {
      this.exteriorObject.setEnabled(false)
      this.exteriorObject.dispose()
      this.exteriorObject = null!
    }
  }

  /**
   * Get the cost of this purchase
   */
  public getCost(): number {
    return CostManager.getCost("initial_shop")
  }

  /**
   * Check if the shop has been purchased
   */
  public isAcquired(): boolean {
    return this.entranceBlocker === null && this.exteriorObject === null // Shop is purchased if barrier and exterior are removed
  }

  /**
   * Get the unique ID for this unlockable item
   */
  public getUnlockableId(): string {
    return this.getGameObject().name
  }
  
  public getDisplayName(): string {
    return "Burger Shop Purchase"
  }

  /**
   * Get highlight position for camera showcasing (use purchase area position)
   */
  public getHighlightPosition(outPosition: THREE.Vector3): void {
    if (this.purchaseAreaObject) {
      this.purchaseAreaObject.getWorldPosition(outPosition)
    } else {
      // Fallback to component position
      this.gameObject.getWorldPosition(outPosition)
    }
  }
}
