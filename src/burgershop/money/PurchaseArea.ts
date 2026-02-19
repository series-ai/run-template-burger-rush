import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { UIUtils } from "@series-inc/rundot-3d-engine/systems"
import { InteractionZone } from "@series-inc/rundot-3d-engine"
import { MoneySystem } from "./MoneySystem"
import { PlayerComponent } from "@game"
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"
import { MoneyChangeIndicator } from "./MoneyChangeIndicator"
import { PURCHASE_AREA_DELAY, PURCHASE_AREA_FILL_DURATION } from "../BurgerShopBalanceConfig"
import { TweenSystem, Easing } from "@series-inc/rundot-3d-engine/systems"
import { ShepardTone } from "./ShepardTone"

/**
 * Three.js version of Purchase Area component that creates a ground-based UI element for collecting money
 * Features a progress bar that fills as money is collected
 * Continuously drains money from players when they are in the interaction zone
 * Uses UISystem for world-space UI and Rapier physics for trigger detection
 */
export class PurchaseArea extends Component {
  // Constants
  private static readonly GROUND_HEIGHT = 0.05 // Height of the ground plane
  private static readonly STORAGE_KEY_PREFIX = "burger_shop_purchase_progress_"
  private static readonly TITLE_FONT_SIZE = 60 // Font size for the title text
  private static readonly AMOUNT_FONT_SIZE = 60 // Font size for the amount text
  private static readonly CENTER_OFFSET = 50 // Vertical offset from center for title and amount positioning
  private static readonly BACKGROUND_COLOR = "rgba(1, 1, 1, 0.65)" // Light warm gray, more transparent

  // Configuration
  private size: THREE.Vector2
  private requiredAmount: number
  private label: string
  private onComplete: (() => void) | null
  private fillDuration: number = PURCHASE_AREA_FILL_DURATION

  // Unique identifier for this purchase area
  private storageKey: string = ""

  // Visual elements
  private groundPlane: THREE.Mesh | null = null
  private canvas: HTMLCanvasElement | null = null
  private canvasTexture: THREE.CanvasTexture | null = null
  private ctx: CanvasRenderingContext2D | null = null
  private moneyIcon: HTMLImageElement | null = null

  // Interaction system
  private interactionZone: InteractionZone | null = null
  private playersInZone: Set<GameObject> = new Set()

  // State
  private currentAmount: number = 0
  private isCompleted: boolean = false
  private requiresExit: boolean = false

  // Unique zone identifier for money indicator
  private zoneId: string = ""

  // For periodic saving
  private lastSavedAmount: number = -1
  private saveIntervalId: any = null

  // Log counter for reducing spam
  private drainLogCounter: number = 0

  private delayTimer: number = 0
  private delayProgress: number = 0 // 0 to 1, how much of delay has elapsed

  private targetBorderColor: string = UIUtils.COLORS.BORDER
  private isScaleAnimating: boolean = false

  /**
   * Create a new PurchaseArea
   * @param cost Amount of money required to complete the purchase
   * @param size Size of the purchase area (width, depth) - assumes flat on ground
   * @param label Text label to display
   * @param onComplete Callback function when purchase is completed
   */
  constructor(
    cost: number,
    size: THREE.Vector2 = new THREE.Vector2(2, 2),
    label: string = "Purchase",
    onComplete: (() => void) | null = null,
  ) {
    super()
    this.size = size
    this.requiredAmount = cost
    this.label = label
    this.onComplete = onComplete

    // Create unique storage key based on position and label
    this.storageKey = `${PurchaseArea.STORAGE_KEY_PREFIX}${label.toLowerCase().replace(/\s+/g, "_")}`
  }

  public setOnCompleteCallback(callback: (() => void)): void {
    this.onComplete = callback
  }

  public unsetOnCompleteCallback(): void {
    this.onComplete = null
  }

  public reset(newCost: number): void {
    this.requiredAmount = newCost
    this.fillProgress = 0
    this.currentAmount = 0
    this.isCompleted = false
    this.delayProgress = 0
    // Note: Don't reset requiresExit here - player must exit and re-enter
    // to start draining for the next level. requiresExit is cleared in onPlayerExit()
    this.clearProgress()
    this.updateDisplay()
  }

  /**
   * Called when component is attached to GameObject
   */
  protected onCreate(): void {
    const pos = this.gameObject.position
    // Make key deterministic based on position to allow loading
    this.storageKey += `_${pos.x.toFixed(0)}_${pos.z.toFixed(0)}`
    
    // Create unique zone ID for money indicator
    this.zoneId = `purchase_zone_${pos.x.toFixed(0)}_${pos.z.toFixed(0)}_${this.label.replace(/\s+/g, '_')}`

    // Create visual elements first
    this.createGroundPlaneWithUI()

    // Setup interaction zone for player detection
    this.setupInteractionZone()

    // Load any saved progress, then update display and start saving
    this.loadProgress().then(() => {
      this.updateDisplay()
      this.startPeriodicSave()
    })

    // Update display with initial (zero) progress
    this.updateDisplay()
  }

  /**
   * Load progress from Venus API storage
   */
  private async loadProgress(): Promise<void> {
    try {
      const savedProgress = await RundotGameAPI.appStorage.getItem(this.storageKey)

      if (!savedProgress) {
        // No saved progress is normal (new area, first startup, etc.) - silently default to 0
        this.currentAmount = 0
        return
      }

      const savedAmount = parseInt(savedProgress, 10)
      if (savedAmount > 0 && savedAmount < this.requiredAmount) {
        this.currentAmount = savedAmount
        this.fillProgress = this.currentAmount / this.requiredAmount
      } else if (savedAmount >= this.requiredAmount) {
        // Already completed - don't restore progress
        this.currentAmount = 0
        this.fillProgress = 0
      } else {
        // Invalid data - default to 0
        this.currentAmount = 0
        this.fillProgress = 0
      }
    } catch (error) {
      // Only log actual storage errors, not missing data
      console.error("❌ Error accessing purchase progress storage:", error)
      this.currentAmount = 0
      this.fillProgress = 0
    }
  }

  /**
   * Save progress to Venus API storage
   */
  private async saveProgress(): Promise<void> {
    try {
      await RundotGameAPI.appStorage.setItem(
        this.storageKey,
        this.currentAmount.toString(),
      )
    } catch (error) {
      console.error("❌ Failed to save purchase progress:", error)
    }
  }

  /**
   * Clear progress from Venus API storage
   */
  private async clearProgress(): Promise<void> {
    await RundotGameAPI.appStorage.removeItem(this.storageKey)
  }

  /**
   * Create the ground plane with integrated UI texture using the utility function
   */
  private createGroundPlaneWithUI(): void {
    // Use the world UI utility with consistent pixel density
    const worldUI = UIUtils.createWorldUI(this.size.x, this.size.y, {
      heightOffset: PurchaseArea.GROUND_HEIGHT + 0.05,
      flipOrientation: true,
    })

    // Store references to the created objects
    this.groundPlane = worldUI.plane
    this.canvas = worldUI.canvas
    this.ctx = worldUI.ctx
    this.canvasTexture = worldUI.texture

    // Add the plane to the game object
    this.gameObject.add(this.groundPlane)

    // Wait for font to load before initial render to ensure correct font
    this.waitForFontAndRender()
  }

  /**
   * Wait for the font to be loaded, then render the UI
   */
  private waitForFontAndRender(): void {
    // Try to load the font explicitly
    document.fonts.load(`bold ${PurchaseArea.TITLE_FONT_SIZE}px ${UIUtils.FONT_FAMILY}`).then(() => {
      this.renderUIToCanvas()
    }).catch(() => {
      // Font load failed, render anyway with fallback
      this.renderUIToCanvas()
    })

    // Also use fonts.ready as a backup in case the font is already loading elsewhere
    document.fonts.ready.then(() => {
      // Re-render once all fonts are ready to ensure correct font
      this.renderUIToCanvas()
    })
  }

  /**
   * Render the UI directly to canvas texture (simplified: title, amount left, money icon)
   */
  private renderUIToCanvas(): void {
    if (!this.ctx || !this.canvas) return

    const ctx = this.ctx
    const width = this.canvas.width
    const height = this.canvas.height

    // Reset any existing clipping and clear the full canvas
    ctx.save()
    ctx.setTransform(1, 0, 0, 1, 0, 0)
    ctx.clearRect(0, 0, width, height)
    ctx.restore()

    // Calculate amount left to acquire and progress
    const progressRatio = Math.min(
      this.fillProgress,
      1.0,
    )

    // Draw background with progress fill
    const cornerRadius = 60
    const margin = 10 // Reduced from 80 for smaller outside margin
    const contentWidth = width - margin * 2
    const contentHeight = height - margin * 2

    // Draw background rounded rectangle (using custom less transparent background)
    ctx.fillStyle = PurchaseArea.BACKGROUND_COLOR
    UIUtils.drawRoundedRect(
      ctx,
      margin,
      margin,
      contentWidth,
      contentHeight,
      cornerRadius,
    )
    ctx.fill()

    // Draw progress fill from bottom, clipped to the main rounded rectangle
    if (progressRatio > 0) {
      const progressHeight = contentHeight * progressRatio
      const progressY = margin + (contentHeight - progressHeight)

      // Save state and clip to main rounded rect so fill doesn't bleed
      ctx.save()
      UIUtils.drawRoundedRect(ctx, margin, margin, contentWidth, contentHeight, cornerRadius)
      ctx.clip()

      // Draw simple rectangle - clipping handles the rounded corners
      ctx.fillStyle = MoneySystem.MONEY_COLORS.GREEN_SOLID
      ctx.fillRect(margin, progressY, contentWidth, progressHeight)
      
      ctx.restore()
    }

    // Draw border with dual radial animation from bottom center
    this.drawDualRadialBorder(ctx, margin, contentWidth, contentHeight, cornerRadius)

    // Save state before clipping for text content
    ctx.save()
    
    // Clip for content
    UIUtils.drawRoundedRect(ctx, margin, margin, contentWidth, contentHeight, cornerRadius)
    ctx.clip()

    // Draw title text - consistent world-space size
    ctx.fillStyle = UIUtils.COLORS.WHITE
    ctx.textAlign = "center"
    ctx.textBaseline = "middle"
    ctx.font = `bold ${PurchaseArea.TITLE_FONT_SIZE}px ${UIUtils.FONT_FAMILY}`
    ctx.fillText(this.label, width / 2, height / 2 - PurchaseArea.CENTER_OFFSET)

    // Load and draw money icon
    this.loadAndDrawMoneyIcon(ctx, width, height)
    
    // Restore state to remove clipping for next render
    ctx.restore()
  }

  /**
   * Draw dual radial border that fills from top center going down both sides
   */
  private drawDualRadialBorder(
    ctx: CanvasRenderingContext2D,
    margin: number,
    contentWidth: number,
    contentHeight: number,
    cornerRadius: number
  ): void {
    const lineWidth = 12
    const x = margin
    const y = margin
    const w = contentWidth
    const h = contentHeight
    const r = cornerRadius

    const centerX = x + w / 2
    const topY = y
    const bottomY = y + h

    // Calculate half perimeter (one side of the dual radial)
    const straightTop = (w - r * 2) / 2
    const straightSide = h - r * 2
    const straightBottom = (w - r * 2) / 2
    const arcLength = (Math.PI / 2) * r
    const halfPerimeter = straightTop + arcLength + straightSide + arcLength + straightBottom

    // Helper to draw one half of the border path (starting from bottom center, going up)
    const drawLeftHalf = () => {
      ctx.beginPath()
      ctx.moveTo(centerX, bottomY)
      ctx.lineTo(x + r, bottomY) // Bottom to bottom-left corner
      ctx.arc(x + r, y + h - r, r, Math.PI / 2, Math.PI) // Bottom-left corner
      ctx.lineTo(x, y + r) // Up the left side
      ctx.arc(x + r, y + r, r, Math.PI, -Math.PI / 2) // Top-left corner
      ctx.lineTo(centerX, topY) // To top center
    }

    const drawRightHalf = () => {
      ctx.beginPath()
      ctx.moveTo(centerX, bottomY)
      ctx.lineTo(x + w - r, bottomY) // Bottom to bottom-right corner
      ctx.arc(x + w - r, y + h - r, r, Math.PI / 2, 0, true) // Bottom-right corner (counter-clockwise)
      ctx.lineTo(x + w, y + r) // Up the right side
      ctx.arc(x + w - r, y + r, r, 0, -Math.PI / 2, true) // Top-right corner (counter-clockwise)
      ctx.lineTo(centerX, topY) // To top center
    }

    // Always draw full white border first
    ctx.save()
    ctx.strokeStyle = UIUtils.COLORS.BORDER
    ctx.lineWidth = lineWidth
    ctx.lineCap = "square"
    ctx.lineJoin = "round"
    ctx.setLineDash([])
    drawLeftHalf()
    ctx.stroke()
    drawRightHalf()
    ctx.stroke()
    ctx.restore()

    // Draw animated green border on top when player is in zone
    if (this.playersInZone.size > 0) {
      const progress = this.delayProgress >= 1 ? 1 : this.delayProgress
      
      if (progress > 0) {
        const drawLength = halfPerimeter * progress
        
        ctx.save()
        ctx.strokeStyle = this.targetBorderColor
        ctx.lineWidth = lineWidth
        ctx.lineCap = "square"
        ctx.lineJoin = "round"
        ctx.setLineDash([drawLength, halfPerimeter * 2])

        drawLeftHalf()
        ctx.stroke()

        drawRightHalf()
        ctx.stroke()

        ctx.restore()
      }
    }
  }

  /**
   * Load money icon and draw it with the amount text
   */
  private loadAndDrawMoneyIcon(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    // Create image if not already created
    if (!this.moneyIcon) {
      this.moneyIcon = new Image()
      this.moneyIcon.onload = () => {
        // Redraw the entire canvas when the image is ready, ensuring fresh data
        this.renderUIToCanvas()
      }
      this.moneyIcon.src = "assets/cozy_game_general/money_icon.png"
    } else {
      // Image already loaded, draw immediately
      this.drawMoneyIconAndAmount(ctx, width, height)
    }
  }

  /**
   * Draw the money icon and amount text
   */
  private drawMoneyIconAndAmount(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
  ): void {
    if (!this.moneyIcon || !this.moneyIcon.complete) return

    // Always calculate the amount left from the current state to avoid staleness
    const amountLeft = this.requiredAmount - this.currentAmount

    // Set up text for measuring - consistent world-space size
    ctx.font = `bold ${PurchaseArea.AMOUNT_FONT_SIZE}px ${UIUtils.FONT_FAMILY}`
    const amountText = `${amountLeft}`
    const textMetrics = ctx.measureText(amountText)
    const textWidth = textMetrics.width

    // Calculate icon size and positions - consistent world-space size
    const iconSize = PurchaseArea.AMOUNT_FONT_SIZE * 1.5 // Icon 1.5x the amount font size
    const spacing = 32 // Spacing between icon and text
    const totalWidth = iconSize + spacing + textWidth

    // Center the icon + text combination
    const startX = (width - totalWidth) / 2
    const centerY = height / 2 + PurchaseArea.CENTER_OFFSET // Position below title

    ctx.filter = "brightness(1.25)"
    // Draw money icon
    ctx.drawImage(
      this.moneyIcon,
      startX,
      centerY - iconSize / 2,
      iconSize,
      iconSize,
    )

    ctx.filter = "none"

    // Draw amount text
    ctx.fillStyle = UIUtils.COLORS.WHITE
    ctx.textAlign = "left"
    ctx.textBaseline = "middle"
    ctx.fillText(amountText, startX + iconSize + spacing, centerY)

    // Update texture
    if (this.canvasTexture) {
      this.canvasTexture.needsUpdate = true
    }
  }

  // Helper function moved to UIUtilsThree

  /**
   * Set the camera (no longer needed for purchase areas, but kept for compatibility)
   */
  public setCamera(camera: THREE.Camera): void {
    // No longer needed since money indicator handles its own UI
    // Kept for backwards compatibility with stations that call setCameraForUI
  }

  /**
   * Setup interaction zone for player detection (with hidden visual mesh)
   */
  private setupInteractionZone(): void {
    this.interactionZone = new InteractionZone(
      (entityGameObject: GameObject) => this.onPlayerEnter(entityGameObject),
      (entityGameObject: GameObject) => this.onPlayerExit(entityGameObject),
      {
        width: this.size.x,
        depth: this.size.y,
        active: true,
      },
    )

    this.gameObject.addComponent(this.interactionZone)

    // Hide the interaction zone visual mesh since we have our own UI
    const visualMesh = this.interactionZone.getVisualMesh()
    if (visualMesh) {
      visualMesh.visible = false
    }
  }

  /**
   * Handle player entering the interaction zone
   */
  private onPlayerEnter(playerGameObject: GameObject): void {
    const playerComponent = playerGameObject.getComponent(PlayerComponent)
    if (playerComponent && !this.isCompleted) {
      this.playersInZone.add(playerGameObject)

      // Show money indicator when player enters purchase area
      MoneyChangeIndicator.show()

      // Check if player has money
      let hasMoney = false
      try {
        hasMoney = MoneySystem.getMoney() >= 1
      } catch {
        // MoneySystem not initialized yet
      }

      if (hasMoney) {
        // Has money - start normal delay animation with green border
        this.delayTimer = PURCHASE_AREA_DELAY
        this.delayProgress = 0
        this.targetBorderColor = MoneySystem.MONEY_COLORS.GREEN_SOLID
        this.triggerScalePop()
      } else {
        // No money - show full red border immediately, no pop
        this.delayProgress = 1
        this.targetBorderColor = PurchaseArea.NO_MONEY_COLOR
      }
      
      this.updateDisplay()
    }
  }

  /**
   * Trigger a scale pop animation when player enters
   */
  private triggerScalePop(): void {
    if (!this.groundPlane || this.isScaleAnimating) return
    
    this.isScaleAnimating = true
    const popScale = 1.08
    const popDuration = PURCHASE_AREA_DELAY * 0.4 // Pop up takes 40% of delay
    const settleDuration = PURCHASE_AREA_DELAY * 0.6 // Settle back takes 60%
    
    // Pop up
    TweenSystem.tween(
      this.groundPlane.scale,
      "x",
      popScale,
      popDuration,
      (t: number) => Easing.easeOutBack(t)
    )
    const yTween = TweenSystem.tween(
      this.groundPlane.scale,
      "y",
      popScale,
      popDuration,
      (t: number) => Easing.easeOutBack(t)
    )
    
    yTween.onCompleted(() => {
      if (!this.groundPlane) return
      
      // Settle back down
      TweenSystem.tween(
        this.groundPlane.scale,
        "x",
        1.0,
        settleDuration,
        (t: number) => Easing.easeInOutQuad(t)
      )
      const settleYTween = TweenSystem.tween(
        this.groundPlane.scale,
        "y",
        1.0,
        settleDuration,
        (t: number) => Easing.easeInOutQuad(t)
      )
      
      settleYTween.onCompleted(() => {
        this.isScaleAnimating = false
      })
    })
  }

  /**
   * Handle player exiting the interaction zone
   */
  private onPlayerExit(playerGameObject: GameObject): void {
    this.playersInZone.delete(playerGameObject)

    // Hide money indicator when no players in zone (fades after 1 second)
    if (this.playersInZone.size === 0) {
      MoneyChangeIndicator.hide()
      ShepardTone.getInstance().stop()
      this.requiresExit = false
      this.delayProgress = 0
      this.targetBorderColor = UIUtils.COLORS.BORDER
      this.updateDisplay()
    }
  }

  // Color for when player has no money (matches MoneyChangeIndicator)
  private static readonly NO_MONEY_COLOR = "#ff6b6b"

  /**
   * Update method called each frame
   */
  public update(deltaTime: number): void {
    if (this.requiresExit) return

    if (this.isCompleted) return

    // Don't process anything if this GameObject is disabled
    if (!this.gameObject.isEnabled()) {
      return
    }

    // Update border color based on money availability when players are in zone
    if (this.playersInZone.size > 0) {
      try {
        const currentMoney = MoneySystem.getMoney()
        const hasNoMoney = currentMoney < 1
        const newBorderColor = hasNoMoney 
          ? PurchaseArea.NO_MONEY_COLOR 
          : MoneySystem.MONEY_COLORS.GREEN_SOLID
        
        // When no money, show full red border immediately (no fill animation)
        if (hasNoMoney) {
          this.delayProgress = 1
          this.targetBorderColor = newBorderColor
          ShepardTone.getInstance().stop()
          this.updateDisplay()
          return // Don't process delay timer or draining
        }
        
        if (this.targetBorderColor !== newBorderColor) {
          this.targetBorderColor = newBorderColor
          this.updateDisplay()
        }
      } catch {
        // MoneySystem not initialized yet
      }
    }

    if (this.delayTimer > 0) {
      this.delayTimer -= deltaTime
      // Update delay progress for border fill animation
      this.delayProgress = 1 - (this.delayTimer / PURCHASE_AREA_DELAY)
      this.updateDisplay()
      return
    }

    // Process money draining if players are in zone
    if (this.playersInZone.size > 0) {
      this.processDraining(deltaTime)
    }
  }

  // Used to track how much
  private fillProgress: number = 0
  private drainAccumulator: number = 0

  /**
   * Process money draining from players in the zone
   */
  private processDraining(deltaTime: number): void {
    if (this.isCompleted || this.playersInZone.size === 0) {
      return
    }

    const currentMoney = MoneySystem.getMoney()
    if (currentMoney < 1) {
      // Stop Shepard tone if no money
      ShepardTone.getInstance().stop()
      return
    }

    // Update tone pitch based on fill progress
    ShepardTone.getInstance().setProgress(this.fillProgress)

    // Start tone when draining begins (after setting progress so first note is correct)
    if (!ShepardTone.getInstance().getIsPlaying()) {
      ShepardTone.getInstance().start()
    }

    this.fillProgress += (deltaTime / this.fillDuration)

    // Calculate how much to drain based on fill duration
    const drainPerSecond = this.requiredAmount / this.fillDuration
    this.drainAccumulator += drainPerSecond * deltaTime

    const drainAmount = Math.floor(this.drainAccumulator)
    const actualDrainAmount = Math.min(
      drainAmount,
      currentMoney,
      this.requiredAmount - this.currentAmount,
    )

    // Try to drain money from the MoneySystem
    try {
      if (actualDrainAmount > 0 && MoneySystem.spendMoney(actualDrainAmount)) {
        this.currentAmount += actualDrainAmount
        this.drainAccumulator -= actualDrainAmount

        // Check for completion
        if (this.currentAmount >= this.requiredAmount && !this.isCompleted) {
          this.isCompleted = true
          this.requiresExit = true
          this.onPurchaseComplete()
        }
      }
    } catch (error) {
      // MoneySystem not initialized yet - this is normal during startup
      if (
        !(error instanceof Error && error.message.includes("not initialized"))
      ) {
        console.error("Error draining money:", error)
      }
    }

    this.updateDisplay()
  }

  /**
   * Starts a periodic check to save money if it has changed
   */
  private startPeriodicSave(): void {
    if (this.saveIntervalId) {
      clearInterval(this.saveIntervalId)
    }

    this.lastSavedAmount = this.currentAmount

    this.saveIntervalId = setInterval(() => {
      if (this.isCompleted) {
        clearInterval(this.saveIntervalId)
        this.saveIntervalId = null
        return
      }

      if (this.currentAmount !== this.lastSavedAmount) {
        this.saveProgress()
        this.lastSavedAmount = this.currentAmount
      }
    }, 1000) // Check every second
  }

  /**
   * Update the visual display by re-rendering the canvas
   */
  private updateDisplay(): void {
    // Re-render the UI directly to the canvas texture
    this.renderUIToCanvas()
  }

  /**
   * Handle purchase completion
   */
  private onPurchaseComplete(): void {
    // Stop Shepard tone
    ShepardTone.getInstance().stop()

    // Clear progress from storage since purchase is complete
    this.clearProgress()

    // Hide the purchase area BEFORE calling callback
    // This allows the callback to re-enable it if needed (e.g., for multi-level upgrades)
    this.gameObject.setEnabled(false)

    if (this.onComplete) {
      this.onComplete()
    }
  }

  /**
   * Add money to the purchase area manually (for backwards compatibility)
   * @param amount Amount to add
   * @returns true if money was added, false if already completed
   */
  public addMoney(amount: number): boolean {
    if (this.isCompleted) {
      return false
    }

    this.currentAmount = Math.min(
      this.currentAmount + amount,
      this.requiredAmount,
    )
    this.updateDisplay()

    // Check for completion
    if (this.currentAmount >= this.requiredAmount && !this.isCompleted) {
      this.isCompleted = true
      this.onPurchaseComplete()
    }

    return true
  }

  /**
   * Get current progress amount
   */
  public getCurrentAmount(): number {
    return this.currentAmount
  }

  /**
   * Get required amount
   */
  public getRequiredAmount(): number {
    return this.requiredAmount
  }

  /**
   * Check if purchase is completed
   */
  public isComplete(): boolean {
    return this.isCompleted
  }

  /**
   * Component cleanup
   */
  protected onCleanup(): void {
    // Hide money indicator when purchase area is destroyed
    MoneyChangeIndicator.hide()

    // Stop Shepard tone
    ShepardTone.getInstance().stop()

    // Stop periodic saving
    if (this.saveIntervalId) {
      clearInterval(this.saveIntervalId)
      this.saveIntervalId = null
    }

    // Clean up Three.js objects
    if (this.groundPlane) {
      this.groundPlane.geometry.dispose()
      if (this.groundPlane.material instanceof THREE.Material) {
        this.groundPlane.material.dispose()
      }
    }

    // Clean up canvas texture
    if (this.canvasTexture) {
      this.canvasTexture.dispose()
      this.canvasTexture = null
    }

    // Clean up canvas
    this.canvas = null
    this.ctx = null

    this.playersInZone.clear()

    super.onCleanup()
  }
}
