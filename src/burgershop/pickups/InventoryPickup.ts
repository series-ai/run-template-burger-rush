import { UpgradeManager } from "@game/upgrade-station/UpgradeManager"
import { BuffPickup } from "./BuffPickup"

export class InventoryPickup extends BuffPickup {

    constructor(buffDuration: number) {
        super(buffDuration)
        this.displayText = "🧤"
        this.popupTitle = "Carry More!"
        const increase = UpgradeManager.getInventoryBoostIncrease()
        this.popupBody = `Carry ${increase}% more items!\nDuration: ${buffDuration}s`
    }

    protected consumePickup(): void {
        if (this.consumed) return
        super.consumePickup()

        UpgradeManager.setInventoryBoost(true)
    }

    protected onCleanup(): void {
        if (!this.consumed) return
        UpgradeManager.setInventoryBoost(false)
        super.onCleanup()
    }
}