import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { Particle, ParticleSystemPrefabComponent, PrefabLoader, StowKitSystem, UISystem } from "@series-inc/rundot-3d-engine/systems"
import * as THREE from "three"
import { Timer } from "@game/Timer"
import { MoneySystem } from "./MoneySystem"

export class OneOffMoneyReward extends Component {
    // Particle component
    private particleComponent: ParticleSystemPrefabComponent | null = null
    private particleObject: GameObject | null = null

    private animationTimer: Timer = new Timer(2.0)
    
    // UI indicator
    private uiElement: any = null
    private readonly id: string
    private worldPosition: THREE.Vector3 = new THREE.Vector3()
    private camera: THREE.Camera | null = null
    private currentAmount: number = 0
    private startYOffset: number = 2.0
    private endYOffset: number = 6.0
    
    constructor() {
        super()
        this.id = `money_reward_${Math.random().toString(36).substr(2, 9)}`
        UISystem.initialize()
    }

    protected onCreate(): void {
        this.setupParticleSystem()
    }

    public update(deltaTime: number): void {
        this.animationTimer.tick(deltaTime)

        // Update UI indicator position and opacity
        if (this.uiElement && this.camera) {
            const progress = this.animationTimer.getProgress()
            
            // Interpolate Y offset from start to end
            const currentYOffset = this.startYOffset + (this.endYOffset - this.startYOffset) * progress
            
            // Update world position
            this.gameObject.getWorldPosition(this.worldPosition)
            this.worldPosition.y += currentYOffset
            this.uiElement.worldPosition.copy(this.worldPosition)
            
            // Fade out over time (start fading after 50% progress)
            const opacity = progress < 0.5 ? 1.0 : 1.0 - ((progress - 0.5) * 2)
            if (this.uiElement.element) {
                this.uiElement.element.style.opacity = opacity.toString()
            }
        }

        if (this.animationTimer.isDone()) {
            this.hide()
        }
    }

    protected onCleanup(): void {
        if (this.particleObject) {
            this.particleObject.dispose()
        }
        
        if (this.uiElement) {
            this.uiElement.remove()
            this.uiElement = null
        }
    }

    public show(amount: number, worldPosition: THREE.Vector3, camera: THREE.Camera): void {
        this.gameObject.position.copy(worldPosition)
        this.camera = camera
        this.currentAmount = amount

        // Trigger particle effect
        this.particleComponent?.trigger(amount)
        
        // Create UI indicator
        this.animationTimer.reset()
        this.createUIElement()
    }

    public hide(): void {
        this.gameObject.position.set(0, 0, -35)
        this.animationTimer.reset()
        
        // Remove UI element
        if (this.uiElement) {
            this.uiElement.remove()
            this.uiElement = null
        }

        // Return this reward to the pool (similar to SelfCheckoutCustomer pattern)
        MoneySystem.ReturnRewardToPool(this)
    }
    
    /**
     * Setup the particle system for money effects
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
     * Create the UI element showing the money amount
     */
    private createUIElement(): void {
        if (!this.camera) {
            return
        }

        // Remove existing UI element if any
        if (this.uiElement) {
            this.uiElement.remove()
            this.uiElement = null
        }

        // Update initial world position
        this.gameObject.getWorldPosition(this.worldPosition)
        this.worldPosition.y += this.startYOffset

        const content = this.buildHTMLContent()

        this.uiElement = UISystem.createWorldSpaceUI(
            this.id,
            content,
            this.worldPosition,
            this.camera,
            {
                className: "money-reward-indicator",
                offset: { x: 0, y: -30 },
            },
        )
    }

    /**
     * Build the HTML content for the money indicator
     */
    private buildHTMLContent(): string {
        const formattedAmount = `+$${this.currentAmount}`
        const content = `
            <div style="display: flex; align-items: center; gap: 6px; pointer-events: none;">
                <div style="display: flex; align-items: center;">
                    <span class="money-display-icon"></span>
                </div>
                <div
                    style="
                        color: #4ade80;
                        font-size: 24px;
                        font-weight: 700;
                        font-family: var(--game-font);
                        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.8), 0 0 10px rgba(74, 222, 128, 0.5);
                        white-space: nowrap;
                        transform-origin: center;
                    "
                >${formattedAmount}</div>
            </div>
        `

        return content
    }
}