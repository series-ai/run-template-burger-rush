import * as THREE from "three"
import { UISystem } from "@series-inc/rundot-3d-engine/systems"
import { GameObject } from "@series-inc/rundot-3d-engine"

export interface DecidingIndicatorConfig {
    heightOffset?: number
    animationSpeed?: number // Time in seconds per dot cycle
}

/**
 * Visual indicator showing customer is deciding their order
 * Displays animated dots (., .., ...) in a styled bubble
 */
export class DecidingIndicator {
    private worldPosition: THREE.Vector3 = new THREE.Vector3()
    private uiElement: any = null
    private config: Required<DecidingIndicatorConfig>
    private camera: THREE.Camera | null = null
    private isVisible: boolean = false
    private parentObject: any = null
    private animationTimer: number = 0
    private currentDots: number = 1

    public readonly id: string

    constructor(config: DecidingIndicatorConfig = {}) {
        this.id = `deciding_indicator_${Math.random().toString(36).substr(2, 9)}`

        this.config = {
            heightOffset: config.heightOffset ?? 3.0,
            animationSpeed: config.animationSpeed ?? 0.5,
        }

        UISystem.initialize()
    }

    /**
     * Attach the indicator to a GameObject and camera
     */
    public attachTo(parentObject: any, camera: THREE.Camera): void {
        this.camera = camera
        this.parentObject = parentObject
        this.updateWorldPosition(parentObject)
    }

    /**
     * Update the world position based on parent object position
     */
    private updateWorldPosition(parentObject: any): void {
        if (parentObject) {
            if (parentObject.getWorldPosition) {
                parentObject.getWorldPosition(this.worldPosition)
            } else if (parentObject.position) {
                this.worldPosition.copy(parentObject.position)
            }

            this.worldPosition.y += this.config.heightOffset
        }
    }

    /**
     * Get dots string based on animation state
     */
    private getDotsString(): string {
        return '.'.repeat(this.currentDots)
    }

    /**
     * Create the HTML/CSS UI element
     */
    private createUIElement(): void {
        if (!this.camera) {
            return
        }

        if (this.uiElement) {
            this.uiElement.remove()
            this.uiElement = null
        }

        if (this.parentObject) {
            this.updateWorldPosition(this.parentObject)
        }

        const dots = this.getDotsString()

        const content = `
            <div
                class="deciding-indicator"
                style="
                    background: linear-gradient(135deg, rgba(139,92,246,0.7) 0%, rgba(124,58,237,0.85) 100%);
                    color: #ffffff;
                    padding: 6px 12px;
                    border-radius: 16px;
                    box-shadow: 0 3px 0 rgba(109,40,217,0.5), 0 5px 12px rgba(139,92,246,0.25);
                    transform-origin: center;
                    font-family: var(--game-font);
                    min-width: 60px;
                    text-align: center;
                    white-space: nowrap;
                "
            >
                <div class="deciding-content" style="display: inline-flex; align-items: center; justify-content: center;">
                    <span style="font-size: 24px; font-weight: 700; letter-spacing: 2px;">${dots}</span>
                </div>
            </div>
        `

        this.uiElement = UISystem.createWorldSpaceUI(
            this.id,
            content,
            this.worldPosition,
            this.camera,
            {
                className: "ui-deciding-indicator",
                offset: { x: 0, y: -30 },
            },
        )
    }

    /**
     * Update the indicator animation and position
     */
    public update(parentObject: GameObject, camera: THREE.Camera, deltaTime: number): void {
        this.camera = camera
        this.parentObject = parentObject

        if (this.isVisible) {
            // Update animation timer
            this.animationTimer += deltaTime
            if (this.animationTimer >= this.config.animationSpeed) {
                this.animationTimer = 0
                this.currentDots = (this.currentDots % 3) + 1
                
                // Recreate UI with new dots
                this.hide()
                this.show()
            }

            // Update position
            if (this.uiElement) {
                this.updateWorldPosition(parentObject)
                this.uiElement.worldPosition.copy(this.worldPosition)
            }
        }
    }

    /**
     * Show the indicator
     */
    public show(): void {
        if (!this.isVisible) {
            this.createUIElement()
            this.isVisible = true
        }
    }

    /**
     * Hide the indicator
     */
    public hide(): void {
        if (this.isVisible && this.uiElement) {
            this.uiElement.remove()
            this.uiElement = null
            this.isVisible = false
        }
    }

    /**
     * Reset animation to start
     */
    public reset(): void {
        this.animationTimer = 0
        this.currentDots = 1
    }

    /**
     * Check if the indicator is currently visible
     */
    public getIsVisible(): boolean {
        return this.isVisible
    }

    /**
     * Dispose of the indicator and clean up resources
     */
    public dispose(): void {
        if (this.uiElement) {
            this.uiElement.remove()
            this.uiElement = null
        }
        this.isVisible = false
        this.camera = null
        this.parentObject = null
    }
}

