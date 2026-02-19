import * as THREE from "three"
import { Component, GameObject, MeshRenderer } from "@series-inc/rundot-3d-engine"
import { StowKitSystem, ParticleSystemPrefabComponent } from "@series-inc/rundot-3d-engine/systems"
import { InteractionZone } from "@series-inc/rundot-3d-engine"
import { PlayerComponent } from "@game"
import { MoneySystem } from "./MoneySystem"
import { Particle, Audio2D, TweenSystem, Easing, Tween, PrefabLoader } from "@series-inc/rundot-3d-engine/systems"

/**
 * Three.js version of MoneyPile component
 * Represents a pile of money that grows and shrinks based on amount
 * Uses the Three.js component architecture
 */
export class MoneyPile extends Component {
  // Static profit multiplier that can be modified by upgrades
  public static profitMultiplier: number = 1.0

  // Configuration
  private readonly minScale = 0.05 // Scale when empty
  private readonly maxScale = 3.0 // Maximum height scale
  private readonly moneyToScaleRatio = 0.02 // How much each dollar affects scale
  private readonly growSpeed: number = 5.0 // Units per second
  private readonly shrinkSpeed: number = 10.0 // Units per second

  private moneyObject!: GameObject
  private moneyMeshComponent: MeshRenderer | null = null
  private interactionZone!: InteractionZone
  private playersInZone: Set<GameObject> = new Set()

  // State
  private currentMoney: number = 0
  private currentScale: number = this.minScale
  private isVisible: boolean = false
  private shrinkTween: Tween | null = null
  private growTween: Tween | null = null
  private juiceScaleOffset: number = 0 // Additive scale offset for juice animation

  // Particle component
  private particleComponent: ParticleSystemPrefabComponent | null = null
  private particleObject: GameObject | null = null

  // Audio component
  private audioComponent: Audio2D | null = null

  constructor() {
    super()
  }

  protected onCreate(): void {
    console.log("🪙 Creating MoneyPile...")

    // Create the money pile display
    this.createMoneyPileDisplay()

    // Setup interaction zone
    this.setupInteractionZone()

    // Setup particle system
    this.setupParticleSystem()

    // Setup audio system
    this.setupAudioSystem()

    console.log("✅ MoneyPile created successfully")
  }

  /**
   * Setup the particle system for money effects using pfx_money prefab
   */
  private setupParticleSystem(): void {
    // Get the pfx_money prefab from the collection
    const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
    const moneyPrefab = prefabCollection.getPrefabByName("pfx_money")
    
    if (!moneyPrefab) {
      console.warn("pfx_money prefab not found, particles disabled")
      return
    }
    
    // Instantiate the prefab as a child of the money pile
    const instance = PrefabLoader.instantiatePrefab(moneyPrefab, this.gameObject)
    this.particleObject = instance.gameObject
    
    // Get the Particle component from the instantiated prefab
    // Note: Use ParticleSystemPrefabComponent since getComponent uses exact class matching
    this.particleComponent = this.particleObject.getComponent(ParticleSystemPrefabComponent) ?? null
  }

  /**
   * Setup the audio system for money sounds
   */
  private setupAudioSystem(): void {
    // Create Audio2D component with the cash pickup sound
    this.audioComponent = new Audio2D(["pick up cash"])
    this.gameObject.addComponent(this.audioComponent)
  }

  /**
   * Creates the money pile display object
   */
  private createMoneyPileDisplay(): void {
    this.moneyObject = new GameObject("MoneyPileObject")
    this.moneyObject.position.set(0, 0, 0)
    this.gameObject.add(this.moneyObject)

    this.moneyMeshComponent = new MeshRenderer("restaurant_display_Money")
    this.moneyObject.addComponent(this.moneyMeshComponent)

    // Set initial scale and hide
    this.updateScale(this.currentScale)
    this.moneyObject.setEnabled(false)
    this.isVisible = false
  }

  /**
   * Setup the interaction zone for player interaction
   */
  private setupInteractionZone(): void {
    console.log("🔄 Setting up interaction zone for money pile...")

    // Create interaction zone GameObject
    const interactionZoneObject = new GameObject("MoneyPileInteractionZone")
    interactionZoneObject.position.set(0, 0, 0)
    this.gameObject.add(interactionZoneObject)

    // Create interaction zone component with callbacks
    this.interactionZone = new InteractionZone(
      (other: GameObject) => this.onPlayerEnter(other),
      (other: GameObject) => this.onPlayerExit(other),
      {
        width: 2,
        depth: 2,
        active: true, // Always active to detect players
        show: false,
      },
    )

    interactionZoneObject.addComponent(this.interactionZone)
    console.log("🔄 Money pile interaction zone setup complete")
  }

  /**
   * Handle player entering the interaction zone
   */
  private onPlayerEnter(playerGameObject: GameObject): void {
    // Check if this GameObject has a PlayerComponent
    const playerComponent = playerGameObject.getComponent(PlayerComponent)

    if (playerComponent) {
      this.playersInZone.add(playerGameObject)
      
      // Only interact if there's money available
      if (this.currentMoney > 0) {
        // Try to give money to player
        this.onPlayerInteract()
      }
    }
  }

  /**
   * Handle player exiting the interaction zone
   */
  private onPlayerExit(playerGameObject: GameObject): void {
    // Check if this GameObject has a PlayerComponent
    const playerComponent = playerGameObject.getComponent(PlayerComponent)

    if (playerComponent) {
      this.playersInZone.delete(playerGameObject)
    }
  }

  /**
   * Add money to the pile
   * @param amount Amount to add
   */
  public addMoney(amount: number): void {
    // Apply profit multiplier to the amount
    const multipliedAmount = Math.floor(amount * MoneyPile.profitMultiplier)
    this.currentMoney += multipliedAmount
    // Added money to pile with profit multiplier

    // If we were mid-shrink tween, stop it so growth can resume
    if (this.shrinkTween && this.shrinkTween.isActive()) {
      this.shrinkTween.stop()
      this.shrinkTween = null
    }

    // Stop any existing grow tween before starting a new one
    if (this.growTween && this.growTween.isActive()) {
      this.growTween.stop()
      this.growTween = null
    }

    // Ensure the pile is visible
    if (!this.isVisible && this.moneyObject) {
      this.moneyObject.setEnabled(true)
      this.isVisible = true
    }

    // Check if any players are already in the zone and should collect
    if (this.playersInZone.size > 0) {
      // Trigger collection for players already standing on the pile
      this.onPlayerInteract()
    }

    // Target scale based on new money
    const targetScale = Math.min(
      this.minScale + this.currentMoney * this.moneyToScaleRatio,
      this.maxScale,
    )

    // Reset juice offset when growing
    this.juiceScaleOffset = 0
    
    // Single tween with spring settle (higher damping for faster settle)
    this.growTween = TweenSystem.tween(
      this,
      "currentScale",
      targetScale,
      0.35,
      (t: number) => Easing.spring(t, 2.8, 1.5),
    )
      .onUpdated(() => {
        this.updateScale(this.currentScale)
      })
      .onCompleted(() => {
        // Ensure we end exactly at target
        this.currentScale = targetScale
        this.juiceScaleOffset = 0
        this.updateScale(targetScale)
        this.growTween = null
      })
  }

  /**
   * Called when a player interacts with the money pile
   */
  private onPlayerInteract(): void {
    // Check money availability
    if (this.currentMoney > 0) {
      this.givePlayerMoney()
      // Trigger money particle burst
      if (this.particleComponent) {
        this.particleComponent.trigger(40)
      }
    }
  }

  /**
   * Remove money from the pile and give it to the player
   */
  private givePlayerMoney(): void {
    if (this.currentMoney > 0) {
      const moneyToGive = this.currentMoney
      this.currentMoney = 0

      // Add money to the player's money system with animation
      MoneySystem.addMoneyAnimated(moneyToGive)
      // Money collected

      // Play pickup cash sound
      if (this.audioComponent) {
        this.audioComponent.play("pick up cash")
      }

      // Cancel any active grow tween
      if (this.growTween && this.growTween.isActive()) {
        this.growTween.stop()
        this.growTween = null
      }

      // Stop any existing shrink tween before starting a new one
      if (this.shrinkTween && this.shrinkTween.isActive()) {
        this.shrinkTween.stop()
      }

      // Store the starting scale for the animation
      const startScale = this.currentScale
      const juiceAmount = 0.15 // Much smaller juice amount for subtle effect
      
      // Use the original approach but with additive offset
      // The anticipateOvershoot easing creates a value that goes from 0 to 1
      // with anticipation (slight pullback) and overshoot
      this.shrinkTween = TweenSystem.tween(
        this,
        "currentScale",
        0,
        0.22,
        (t: number) => {
          // Apply juice effect based on the easing curve
          const easedValue = Easing.anticipateOvershoot(t, 8.0) // Much lower tension value
          
          // Calculate juice: maximum at the anticipation/overshoot points
          // When easedValue < 0 (anticipation) or > 1 (overshoot), we add juice
          if (easedValue < 0) {
            // During anticipation (pullback), add positive juice to create the "bulge"
            this.juiceScaleOffset = Math.abs(easedValue) * juiceAmount
          } else if (easedValue > 1) {
            // During overshoot, add very small juice
            this.juiceScaleOffset = (easedValue - 1) * juiceAmount * 0.3
          } else {
            // Normal range, no juice
            this.juiceScaleOffset = 0
          }
          
          return easedValue
        },
      )
        .onUpdated(() => {
          this.updateScale(this.currentScale)
        })
        .onCompleted(() => {
          // Ensure we end hidden and disable interaction
          this.currentScale = 0
          this.juiceScaleOffset = 0
          this.updateScale(0)
          if (this.moneyObject) {
            this.moneyObject.setEnabled(false)
          }
          this.isVisible = false
          this.shrinkTween = null
        })
    }
  }

  /**
   * Update function called each frame
   */
  public update(deltaTime: number): void {
    this.updateDisplay(deltaTime)
    // Particle component updates itself automatically
  }

  /**
   * Update the display based on current money
   */
  private updateDisplay(deltaTime: number): void {
    if (!this.moneyMeshComponent || !this.moneyObject) return

    if (this.currentMoney > 0) {
      // If a grow tween is active, let it control growth this frame
      if (this.growTween && this.growTween.isActive()) {
        this.updateScale(this.currentScale)
        return
      }
      const targetScale = Math.min(
        this.minScale + this.currentMoney * this.moneyToScaleRatio,
        this.maxScale,
      )

      // Scale calculations

      if (this.currentScale >= targetScale) return

      if (!this.isVisible) {
        this.moneyObject.setEnabled(true)
        this.isVisible = true
      }

      this.currentScale = Math.min(
        this.currentScale + this.growSpeed * deltaTime,
        targetScale,
      )
      this.updateScale(this.currentScale)
    } else {
      if (!this.isVisible) return

      // If a shrink tween is active, let it drive the scale and skip linear shrink
      if (this.shrinkTween && this.shrinkTween.isActive()) {
        this.updateScale(this.currentScale)
        return
      }

      this.currentScale = Math.max(
        this.currentScale - this.shrinkSpeed * deltaTime,
        this.minScale,
      )
      this.updateScale(this.currentScale)

      if (this.currentScale <= this.minScale) {
        this.moneyObject.setEnabled(false)
        this.isVisible = false
      }
    }
  }

  /**
   * Update the scale of the money pile
   */
  private updateScale(scale: number): void {
    // Allow going below minScale (sinks under floor) but prevent negative flip
    const clampedNonNegative = Math.max(scale, 0)
    this.currentScale = clampedNonNegative
    if (this.moneyObject) {
      // Apply base scale plus juice offset additively
      const finalScale = this.currentScale + this.juiceScaleOffset
      this.moneyObject.scale.set(1, Math.max(finalScale, 0), 1)
      // Temporary debug to verify scaling is working
      if (Math.abs(clampedNonNegative - 0.05) > 0.01) {
        // Only log when scale changes significantly from minimum
        // Money pile scale updated
      }
    }
  }

  /**
   * Get current money amount (for debugging)
   */
  public getCurrentMoney(): number {
    return this.currentMoney
  }

  /**
   * Check if the money pile is visible
   */
  public getIsVisible(): boolean {
    return this.isVisible
  }

  protected onCleanup(): void {
    if (this.moneyObject) {
      this.moneyObject.dispose()
    }

    if (this.particleObject) {
      this.particleObject.dispose()
    }

    this.playersInZone.clear()
  }
}
