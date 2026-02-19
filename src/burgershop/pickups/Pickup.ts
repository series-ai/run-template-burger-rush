import { PICKUP_LIFE_SPAN, PURCHASE_AREA_DELAY } from "@game/BurgerShopBalanceConfig"
import { InteractionAreaDisplay } from "@game/checkout-station/InteractionAreaDisplay"
import { MoneySystem } from "@game/money"
import { PlayerComponent } from "@game/PlayerComponent"
import { Timer } from "@game/Timer"
import { Component, GameObject, InteractionZone } from "@series-inc/rundot-3d-engine"
import { UIUtils } from "@series-inc/rundot-3d-engine/systems"
import * as THREE from "three"
import { PickupConfirmPopupUI } from "./PickupConfirmPopupUI"
import { PickupManager } from "./PickupManager"

export class Pickup extends Component {
    protected displayText: string = "X"
    protected popupTitle: string = "Pickup Confirmation"
    protected popupBody: string = "Are you sure you want to consume this pickup?"

    protected camera!: THREE.Camera

    // Display plane for showing pickup letter
    protected displayPlane: THREE.Mesh | null = null
    protected canvas: HTMLCanvasElement | null = null
    protected canvasTexture: THREE.CanvasTexture | null = null
    protected ctx: CanvasRenderingContext2D | null = null

    protected interactionZone!: InteractionZone
    protected interactionZoneObject!: GameObject

    private playersInZone: Set<GameObject> = new Set()

    private timer: Timer = new Timer(PURCHASE_AREA_DELAY * 1.5)
    protected deathTimer: Timer = new Timer(PICKUP_LIFE_SPAN)
    private animTimer: number = 0

    private popup: PickupConfirmPopupUI | null = null

    // Size of the display plane (world units)
    private readonly displaySize = new THREE.Vector2(2.5, 2.5)
    private static readonly GROUND_HEIGHT = 0.05

    constructor() {
        super()
        this.displayText = "👌"
    }

    protected onCreate(): void {
        this.createDisplayPlane()
        this.setupInteractionZone()
        PickupManager.addSpawnedPickup(this)
    }

    public setLifeSpan(lifeTime: number): void {
        this.deathTimer = new Timer(lifeTime)
        this.deathTimer.reset()
    }

    public setCamera(camera: THREE.Camera): void {
        this.camera = camera
    }

    public destroy(): void {
        PickupManager.removeSpawnedPickup(this)
        this.gameObject.removeFromParent()
        this.gameObject.dispose()
    }

    public update(deltaTime: number): void {
        if (this.popup?.isVisible) {
            return
        }

        this.animTimer += deltaTime * Math.PI

        const scaleOffset = Math.cos(this.animTimer) * 0.07
        let targetScale = new THREE.Vector3(1 + scaleOffset, 1 + scaleOffset, 1 + scaleOffset)

        if (this.playersInZone.size > 0) {
            this.timer.tick(deltaTime)

            if (this.timer.isDone()) {
                this.openPopup()
                this.timer.reset()
            }
            targetScale = new THREE.Vector3(1.15, 1.15, 1.15)
        }
        else {
            this.deathTimer.tick(deltaTime)

            if (this.deathTimer.isDone()) {
                this.destroy()
            }

            if (this.timer.isRunning())
            {
                this.timer.reset()
            }
        }

        this.displayPlane?.scale.lerp(targetScale, 12 * deltaTime)

        this.renderUI()
    }

    protected openPopup(): void {
        if (!this.popup) {
            this.popup = new PickupConfirmPopupUI(
            this.popupTitle, 
            this.popupBody, 
            () => this.onConfirmPopup(), 
            () => this.onCancelPopup()
            )
        }

        this.popup.show()
    }

    private onConfirmPopup(): void {
        this.popup?.hide()
        this.consumePickup()
    }

    private onCancelPopup(): void {
        this.popup?.hide()
        this.popup = null

        this.timer.reset()
    }

    protected consumePickup(): void {
        this.timer.reset()
    }

    private setupInteractionZone(): void {
        // Create checkout zone
        this.interactionZoneObject = new GameObject("PickupInteractionZone")
        this.gameObject.add(this.interactionZoneObject)

        this.interactionZoneObject.position.copy(new THREE.Vector3(0, 0, 0))

        this.interactionZone = new InteractionZone(
            (other: GameObject) => this.onEnterZone(other),
            (other: GameObject) => this.onExitZone(other),
            {
                width: 2.5,
                depth: 2.5,
                active: true,
                show: false,
            },
        )
        this.interactionZoneObject.addComponent(this.interactionZone)
    }

    private onEnterZone(other: GameObject): void {
        const playerComponent = other.getComponent(PlayerComponent)
        if (!playerComponent) {
            return
        }
        this.playersInZone.add(other)
    }

    private onExitZone(other: GameObject): void {
        const playerComponent = other.getComponent(PlayerComponent)
        if (!playerComponent) {
            return
        }
        this.playersInZone.delete(other)

        if (this.playersInZone.size < 1) {
            this.timer.reset()
            this.renderUI()
        }
    }

    /**
     * Create the display plane with world-space canvas UI
     */
    private createDisplayPlane(): void {
        // Use the world UI utility (same as PurchaseArea)
        const worldUI = UIUtils.createWorldUI(this.displaySize.x, this.displaySize.y, {
            heightOffset: Pickup.GROUND_HEIGHT + 0.05,
            flipOrientation: true,
        })

        // Store references to the created objects
        this.displayPlane = worldUI.plane
        this.canvas = worldUI.canvas
        this.ctx = worldUI.ctx
        this.canvasTexture = worldUI.texture

        // Add the plane to the game object
        this.gameObject.add(this.displayPlane)

        this.displayPlane.scale.set(0, 0, 0)

        this.renderUI()
    }

    private renderUI(): void {
        this.renderImagesToCanvas()
        this.renderTextToCanvas()
    }

    protected renderImagesToCanvas(): void {
        if (!this.ctx || !this.canvas) return

        const ctx = this.ctx
        const width = this.canvas.width
        const height = this.canvas.height
        const padding = 12
        const contentWidth = width - 2 * padding
        const contentHeight = height - 2 * padding
        const activateProgress = this.timer.getProgress()
        const deathProgress = this.deathTimer.getProgress()

        // Clear canvas
        ctx.clearRect(0, 0, width, height)

        // Draw background circle using rounded rectangle

        // Draw background rounded rectangle
        ctx.fillStyle = UIUtils.COLORS.BACKGROUND
        UIUtils.drawRoundedRect(
            ctx,
            padding,
            padding,
            width - 2*padding,
            height - 2*padding,
            width/2,
        )
        ctx.fill()

        // Draw progress fill from bottom, clipped to the main rounded rectangle
        if (activateProgress > 0.015) {
            const progressHeight = contentHeight * activateProgress
            const progressY = padding + (contentHeight - progressHeight)

            // Save state and clip to main rounded rect so fill doesn't bleed
            ctx.save()
            UIUtils.drawRoundedRect(ctx, padding, padding, contentWidth, contentHeight, width/2)
            ctx.clip()

            // Draw simple rectangle - clipping handles the rounded corners
            ctx.fillStyle = MoneySystem.MONEY_COLORS.GREEN_SOLID
            ctx.fillRect(padding, progressY, contentWidth, progressHeight)

            ctx.restore()
        }

        // Draw circle outline using path
        const r = width/2

        const drawCircle = () => {
            ctx.beginPath()
            ctx.moveTo(width - padding, height/2)
            ctx.arc(width/2, height/2, r - padding, 0, 2*Math.PI) 
        }

        const circleProgress = 1 - deathProgress

        const leftHalf = () => {
            ctx.beginPath()
            ctx.moveTo(width/2, height - padding)
            ctx.arc(width / 2, height / 2, r - padding, Math.PI/2, Math.PI/2 + (Math.PI * circleProgress)) 
        }

        const rightHalf = () => {
            ctx.beginPath()
            ctx.moveTo(width / 2, height - padding)
            ctx.arc(width / 2, height / 2, r - padding, Math.PI / 2, Math.PI / 2 - (Math.PI * circleProgress), true)
        }

        ctx.save()
        ctx.strokeStyle = UIUtils.COLORS.GRAY
        ctx.lineWidth = 18
        ctx.lineCap = "square"
        ctx.lineJoin = "round"
        ctx.setLineDash([20, 5])
        drawCircle()
        ctx.stroke()

        ctx.strokeStyle = this.playersInZone.size > 0 && this.interactionZone.isActive() ? MoneySystem.MONEY_COLORS.GREEN_SOLID : UIUtils.COLORS.BORDER
        leftHalf()
        ctx.stroke()
        rightHalf()
        ctx.stroke()

        ctx.restore()
    }

    protected renderTextToCanvas(): void {
        if (!this.ctx || !this.canvas) return

        const ctx = this.ctx
        const width = this.canvas.width
        const height = this.canvas.height

        // Draw "X" text
        ctx.fillStyle = UIUtils.COLORS.WHITE
        ctx.font = "bold 148px 'Fredoka', 'Comic Sans MS', cursive"
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(this.displayText, width / 2, height / 2)

        // Update texture
        if (this.canvasTexture) {
            this.canvasTexture.needsUpdate = true
        }
    }

    /**
     * Component cleanup
     */
    protected onCleanup(): void {
        // Clean up Three.js objects
        if (this.displayPlane) {
            this.displayPlane.geometry.dispose()
            if (this.displayPlane.material instanceof THREE.Material) {
                this.displayPlane.material.dispose()
            }
            this.gameObject.remove(this.displayPlane)
            this.displayPlane = null
        }

        // Clean up canvas texture
        if (this.canvasTexture) {
            this.canvasTexture.dispose()
            this.canvasTexture = null
        }

        // Clean up canvas
        this.canvas = null
        this.ctx = null
    }
}