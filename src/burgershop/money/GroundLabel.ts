import * as THREE from "three"
import { Component } from "@series-inc/rundot-3d-engine"
import { UIUtils } from "@series-inc/rundot-3d-engine/systems"

/**
 * Arrow direction for the ground label
 */
export type ArrowDirection = "up" | "down" | "left" | "right"

/**
 * Label size preset
 */
export type LabelSize = "default" | "large"

/**
 * Simple ground-based label component that displays text with an arrow
 * Similar to PurchaseArea but much simpler - no progress bar, no interaction
 * Just a flat label on the ground with black text and an arrow
 */
export class GroundLabel extends Component {
    // Constants
    private static readonly GROUND_HEIGHT = 0.05 // Height of the ground plane
    private static readonly TEXT_COLOR = "#1a1a1a" // Black text

    // Size presets - arrow is now smaller relative to text
    private static readonly SIZE_PRESETS = {
        default: { fontSize: 60, arrowSize: 50, arrowOffset: 85 },
        large: { fontSize: 90, arrowSize: 65, arrowOffset: 130 },
    }

    // Configuration
    private size: THREE.Vector2
    private label: string
    private arrowDirection: ArrowDirection
    private labelSize: LabelSize

    // Visual elements
    private groundPlane: THREE.Mesh | null = null
    private canvas: HTMLCanvasElement | null = null
    private canvasTexture: THREE.CanvasTexture | null = null
    private ctx: CanvasRenderingContext2D | null = null

    /**
     * Create a new GroundLabel
     * @param label Text to display
     * @param arrowDirection Direction the arrow should point
     * @param size Size of the label area (width, depth)
     * @param labelSize Size preset for text and arrow ("default" or "large")
     */
    constructor(
        label: string,
        arrowDirection: ArrowDirection = "up",
        size: THREE.Vector2 = new THREE.Vector2(2, 1.5),
        labelSize: LabelSize = "default",
    ) {
        super()
        this.label = label
        this.arrowDirection = arrowDirection
        this.size = size
        this.labelSize = labelSize
    }

    /**
     * Called when component is attached to GameObject
     */
    protected onCreate(): void {
        this.createGroundPlaneWithUI()
    }

    /**
     * Create the ground plane with integrated UI texture
     */
    private createGroundPlaneWithUI(): void {
        // Use the world UI utility with consistent pixel density
        const worldUI = UIUtils.createWorldUI(this.size.x, this.size.y, {
            heightOffset: GroundLabel.GROUND_HEIGHT,
            flipOrientation: true,
        })

        // Store references to the created objects
        this.groundPlane = worldUI.plane
        this.canvas = worldUI.canvas
        this.ctx = worldUI.ctx
        this.canvasTexture = worldUI.texture

        // Add the plane to the game object
        this.gameObject.add(this.groundPlane)

        // Wait for font to load before rendering to ensure correct font is used
        this.waitForFontAndRender()
    }

    /**
     * Wait for the font to be loaded, then render the label
     */
    private waitForFontAndRender(): void {
        // Try to load the font explicitly
        document.fonts.load(`bold 60px ${UIUtils.FONT_FAMILY}`).then(() => {
            this.renderLabel()
        }).catch(() => {
            // Font load failed, render anyway with fallback
            this.renderLabel()
        })

        // Also use fonts.ready as a backup in case the font is already loading elsewhere
        document.fonts.ready.then(() => {
            // Re-render once all fonts are ready to ensure correct font
            this.renderLabel()
        })
    }

    /**
     * Render the label text and arrow to the canvas
     */
    private renderLabel(): void {
        if (!this.ctx || !this.canvas) return

        const ctx = this.ctx
        const width = this.canvas.width
        const height = this.canvas.height
        const preset = GroundLabel.SIZE_PRESETS[this.labelSize]

        // Clear the canvas (transparent background)
        ctx.clearRect(0, 0, width, height)

        // Calculate positions based on arrow direction
        const centerX = width / 2
        const centerY = height / 2
        const arrowOffset = preset.arrowOffset // Space between arrow and text

        // Determine text and arrow positions
        let textX = centerX
        let textY = centerY
        let arrowX = centerX
        let arrowY = centerY

        switch (this.arrowDirection) {
            case "up":
                textY = centerY + arrowOffset / 2
                arrowY = centerY - arrowOffset / 2
                break
            case "down":
                textY = centerY - arrowOffset / 2
                arrowY = centerY + arrowOffset / 2
                break
            case "left":
                textX = centerX + arrowOffset / 2
                arrowX = centerX - arrowOffset / 2
                break
            case "right":
                textX = centerX - arrowOffset / 2
                arrowX = centerX + arrowOffset / 2
                break
        }

        // Draw the arrow
        this.drawArrow(ctx, arrowX, arrowY, preset.arrowSize)

        // Draw the text
        ctx.fillStyle = GroundLabel.TEXT_COLOR
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.font = `bold ${preset.fontSize}px ${UIUtils.FONT_FAMILY}`
        ctx.fillText(this.label, textX, textY)

        // Update texture
        if (this.canvasTexture) {
            this.canvasTexture.needsUpdate = true
        }
    }

    /**
     * Draw an arrow pointing in the specified direction
     */
    private drawArrow(ctx: CanvasRenderingContext2D, x: number, y: number, arrowSize: number): void {
        const halfSize = arrowSize / 2

        ctx.save()
        ctx.fillStyle = GroundLabel.TEXT_COLOR
        ctx.beginPath()

        switch (this.arrowDirection) {
            case "up":
                // Arrow pointing up (triangle)
                ctx.moveTo(x, y - halfSize) // Top point
                ctx.lineTo(x + halfSize, y + halfSize) // Bottom right
                ctx.lineTo(x - halfSize, y + halfSize) // Bottom left
                break
            case "down":
                // Arrow pointing down (triangle)
                ctx.moveTo(x, y + halfSize) // Bottom point
                ctx.lineTo(x + halfSize, y - halfSize) // Top right
                ctx.lineTo(x - halfSize, y - halfSize) // Top left
                break
            case "left":
                // Arrow pointing left (triangle)
                ctx.moveTo(x - halfSize, y) // Left point
                ctx.lineTo(x + halfSize, y - halfSize) // Top right
                ctx.lineTo(x + halfSize, y + halfSize) // Bottom right
                break
            case "right":
                // Arrow pointing right (triangle)
                ctx.moveTo(x + halfSize, y) // Right point
                ctx.lineTo(x - halfSize, y - halfSize) // Top left
                ctx.lineTo(x - halfSize, y + halfSize) // Bottom left
                break
        }

        ctx.closePath()
        ctx.fill()
        ctx.restore()
    }

    /**
     * Update the label text
     */
    public setLabel(label: string): void {
        this.label = label
        this.renderLabel()
    }

    /**
     * Update the arrow direction
     */
    public setArrowDirection(direction: ArrowDirection): void {
        this.arrowDirection = direction
        this.renderLabel()
    }

    /**
     * Component cleanup
     */
    protected onCleanup(): void {
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

        super.onCleanup()
    }
}
