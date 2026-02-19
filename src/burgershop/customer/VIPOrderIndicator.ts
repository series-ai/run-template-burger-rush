import * as THREE from "three"
import { UISystem } from "@series-inc/rundot-3d-engine/systems"
import { GameObject } from "@series-inc/rundot-3d-engine"
import { Timer } from "@game/Timer"
import { ItemTypes } from "@game/inventory"
import { VIP_REWARD_VALUE_MULTIPLIER } from "@game/BurgerShopBalanceConfig"

export interface VIPOrderIndicatorConfig {
    heightOffset?: number
    orderCounts: Record<string, number>
    orderTime: number
}

/**
 * Visual indicator showing customer is deciding their order
 * Displays animated dots (., .., ...) in a styled bubble
 */
export class VIPOrderIndicator {
    private worldPosition: THREE.Vector3 = new THREE.Vector3()
    private uiElement: any = null
    private config: Required<VIPOrderIndicatorConfig>
    private camera: THREE.Camera | null = null
    private isVisible: boolean = false
    private parentObject: any = null

    private orderTimer!: Timer
    private orderCounts: Record<string, number> = {}

    public readonly id: string

    constructor(config: VIPOrderIndicatorConfig) {
        this.id = `vip_order_indicator_${Math.random().toString(36).substr(2, 9)}`

        this.config = {
            heightOffset: config.heightOffset ?? 4.0,
            orderCounts: config.orderCounts,
            orderTime: config.orderTime,
        }

        this.orderTimer = new Timer(this.config.orderTime)
        this.orderCounts = {}
        for (const itemType in this.config.orderCounts) {
            this.orderCounts[itemType] = this.config.orderCounts[itemType]
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

    public decrementOrderCount(itemType: string): void {
        this.orderCounts[itemType] = Math.max(0, this.orderCounts[itemType] - 1)

        // Update the DOM directly without rebuilding
        if (this.isVisible && this.uiElement) {
            const orderCountsDisplay = this.uiElement.element.querySelector('.order-counts-display')
            if (orderCountsDisplay) {
                orderCountsDisplay.innerHTML = this.getOrderCountsString()
            }
        }
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

    private getOrderCountsString(): string {
        let orderCountsString = ``
        for (const itemType in this.orderCounts) {
            switch (itemType) {
                case ItemTypes.BURGER:
                    orderCountsString += '<span style="font-size: 24px;" >🍔</span>'
                    break
                case ItemTypes.SHAKE:
                    orderCountsString += '🥤'
                    break
                default:
                    orderCountsString += '🍔'
                    break
            }

            orderCountsString += ` <span style = "font-size: 18px; font-weight: 700;"> ${this.orderCounts[itemType]}</span>`
        }

        return orderCountsString
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

        const content = this.buildHTMLContent()

        this.uiElement = UISystem.createWorldSpaceUI(
            this.id,
            content,
            this.worldPosition,
            this.camera,
            {
                className: "vip-order-indicator",
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
        this.orderTimer.tick(deltaTime)

        if (this.isVisible && this.uiElement) {
            // Update only the progress bar width
            const progressPercent = Math.floor((1 - this.orderTimer.getProgress()) * 100)
            const progressBar = this.uiElement.element.querySelector('.progress-fill')
            if (progressBar) {
                (progressBar as HTMLElement).style.width = `${progressPercent}%`
            }

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
            this.orderTimer.reset()
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
    public reset(orderCounts: Record<string, number>, orderTime: number): void {
        this.orderCounts = {}
        for (const itemType in orderCounts) {
            this.orderCounts[itemType] = orderCounts[itemType]
        }

        this.orderTimer = new Timer(orderTime)
        this.orderTimer.reset()
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

    private buildHTMLContent(): string {
        const orderCountsString = this.getOrderCountsString()
        const progressPercent = Math.floor((1 - this.orderTimer.getProgress()) * 100)
        const multiplier = (VIP_REWARD_VALUE_MULTIPLIER).toFixed(1)

        const content = `<div style="position: relative; display: inline-block;">
            <div
                style="
                    background: linear-gradient(135deg, rgba(239,68,68,0.7) 0%, rgba(220,38,38,0.85) 100%);
                    color: #ffffff;
                    padding: 6px 12px;
                    border-radius: 16px;
                    box-shadow: 0 3px 0 rgba(217, 40, 40, 0.5), 0 5px 12px rgba(246, 92, 92, 0.25);
                    transform-origin: center;
                    font-family: var(--game-font);
                    min-width: 60px;
                    text-align: center;
                    white-space: nowrap;
                "
            >
                <div class="order-counts-display" style="display: flex; align-items: center; gap: 10px; margin-bottom: 6px;">${orderCountsString}</div>
                <div style="width: 100%; height: 6px; background: #000; border-radius: 4px; overflow: hidden;">
                    <div class="progress-fill" style="width: ${progressPercent}%; height: 100%; background:rgb(255, 253, 121); transition: width 0.3s ease;"></div>
                </div>
            </div>
            <div style="position: absolute; left: 100%; top: 50%; transform: translateY(-50%); display: flex; align-items: center; gap: 4px; margin-left: 4px;">
                <div style="display: flex; align-items: center; animation: bounce-pulse 1.5s infinite;">
                    <span class="money-display-icon"></span>
                </div>
                <div
                    style="
                        color:rgb(255, 255, 255);
                        font-size: 20px;
                        font-weight: 700;
                        font-family: var(--game-font);
                        text-shadow: 2px 2px 4px rgba(0, 0, 0, 0.5);
                        animation: bounce-pulse 1.5s infinite;
                        transform-origin: center;
                        text-align: center;
                        white-space: nowrap;
                    "
                >${multiplier}x</div>
            </div>
        </div>
    `

        return content
    }
}

