import * as THREE from "three"
import { UISystem } from "@series-inc/rundot-3d-engine/systems"
import { GameObject } from "@series-inc/rundot-3d-engine"

export interface EmptyStackIndicatorConfig {
    itemType: string // e.g., "burger"
    heightOffset?: number // How far above the stack to position the indicator
}

/**
 * Visual indicator showing what item type belongs in an empty stack
 * Displays a line pointing up to a circle with the item icon
 */
export class EmptyStackIndicator {
    private worldPosition: THREE.Vector3 = new THREE.Vector3()
    private uiElement: any = null // UIWorldElement from UISystem
    private config: Required<EmptyStackIndicatorConfig>
    private camera: THREE.Camera | null = null
    private isVisible: boolean = false
    private parentObject: any = null

    public readonly id: string

    constructor(config: EmptyStackIndicatorConfig) {
        this.id = `empty_stack_indicator_${Math.random().toString(36).substr(2, 9)}`

        // Set defaults for config
        this.config = {
            itemType: config.itemType,
            heightOffset: config.heightOffset ?? 2.0,
        }

        // Initialize UI system if needed
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
            // Get world position instead of local position
            if (parentObject.getWorldPosition) {
                // For Three.js objects
                parentObject.getWorldPosition(this.worldPosition)
            } else if (parentObject.position) {
                // Fallback for simple position objects
                this.worldPosition.copy(parentObject.position)
            }

            this.worldPosition.y += this.config.heightOffset
        }
    }

    /**
     * Get the icon for the item type
     */
    private getItemIcon(): string {
        switch (this.config.itemType.toLowerCase()) {
            case "burger":
                return "🍔"
            case "fries":
                return "🍟"
            case "shake":
                return "🥤"
            default:
                return "📦"
        }
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

        // Update position before creating
        if (this.parentObject) {
            this.updateWorldPosition(this.parentObject)
        }

        const itemIcon = this.getItemIcon()

        // Create content with line pointing up to circle with item icon
        const content = `
            <div style="
                display: flex;
                flex-direction: column;
                align-items: center;
                gap: 0;
                white-space: nowrap;
            ">
                <!-- Circle with item icon -->
                <div style="
                    background: linear-gradient(135deg, rgba(139,92,246,0.7) 0%, rgba(124,58,237,0.85) 100%);
                    width: 48px;
                    height: 48px;
                    border-radius: 50%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    box-shadow: 0 3px 0 rgba(109,40,217,0.5), 0 5px 12px rgba(139,92,246,0.25);
                    cursor: default;
                    font-family: var(--game-font);
                    transition: all 0.2s ease;
                    user-select: none;
                    padding: 0;
                    margin: 0;
                    border: none;
                    box-sizing: border-box;
                    line-height: 48px;
                    text-align: center;
                    font-size: 28px;
                ">
                    ${itemIcon}
                </div>
                
                <!-- Line pointing down -->
                <div style="
                    width: 3px;
                    height: 40px;
                    background: linear-gradient(to bottom, rgba(139,92,246,0.7) 0%, rgba(124,58,237,0.3) 100%);
                    border-radius: 2px;
                    box-shadow: 0 2px 4px rgba(109,40,217,0.2);
                "></div>
            </div>
        `

        this.uiElement = UISystem.createWorldSpaceUI(
            this.id,
            content,
            this.worldPosition,
            this.camera,
            {
                className: "ui-empty-stack-indicator",
                offset: { x: 0, y: -60 },
            },
        )
    }

    /**
     * Update the indicator position (call this in your update loop if the parent moves)
     */
    public update(parentObject: GameObject, camera: THREE.Camera): void {
        this.camera = camera
        this.parentObject = parentObject

        if (this.isVisible && this.uiElement) {
            this.updateWorldPosition(parentObject)
            this.uiElement.worldPosition.copy(this.worldPosition)
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


