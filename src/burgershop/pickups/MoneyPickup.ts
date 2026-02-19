import { MoneySystem, UnlockManager } from "@game/money";
import { Pickup } from "./Pickup";
import { Particle, UIUtils } from "@series-inc/rundot-3d-engine/systems"

export class MoneyPickup extends Pickup {
    private moneyValue: number = 50
    private moneyIcon: HTMLImageElement | null = null

    constructor() {
        super()
        this.popupTitle = "Big Money!"
        this.chooseMoneyValue()
        this.popupBody = `Instantly gain <span class="popup-money-icon"></span>${this.moneyValue}!`
    }

    protected onCreate(): void {
        super.onCreate()
    }

    protected consumePickup(): void {
        MoneySystem.OneOffReward(this.moneyValue)
        this.destroy()
    }

    protected renderTextToCanvas(): void {
        if (!this.ctx || !this.canvas) return

        const ctx = this.ctx
        const width = this.canvas.width
        const height = this.canvas.height
        
        this.loadAndDrawMoneyIcon(ctx, width, height)
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
                this.renderTextToCanvas()
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

        const fontSize = 72
        ctx.font = `bold ${fontSize}px 'Fredoka', 'Comic Sans MS', cursive`
        const amountText = `${this.moneyValue}`

        const iconSize = fontSize* 1.5

        const centerY = height / 2

        ctx.filter = "brightness(1.25)"
        // Draw money icon
        ctx.drawImage(
            this.moneyIcon,
            width/2 - iconSize/2,
            centerY - iconSize,
            iconSize,
            iconSize,
        )
        ctx.filter = "none"
        
        // Draw amount text
        ctx.fillStyle = UIUtils.COLORS.WHITE
        ctx.textAlign = "center"
        ctx.textBaseline = "middle"
        ctx.fillText(`+${amountText}`, width/2, centerY + iconSize/2, width - 15)

        // Update texture
        if (this.canvasTexture) {
            this.canvasTexture.needsUpdate = true
        }
    }

    private chooseMoneyValue(): void {
        const purchasables = UnlockManager.getActivePurchasables()
        let moneyAmount = 0

        for (const unlockableKey of purchasables) {
            const unlockable = UnlockManager.getUnlockableById(unlockableKey)
            const amount = (unlockable?.getCost() ?? 0) / 2

            if (amount > moneyAmount) {
                moneyAmount = amount
            }
        }

        if (moneyAmount == 0) {
            moneyAmount = Math.min(1000, MoneySystem.getMoney() / 4)
        }

        this.moneyValue = Math.floor(moneyAmount)
    }
}