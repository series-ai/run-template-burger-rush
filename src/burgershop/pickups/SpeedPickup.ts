import { UpgradeManager } from "@game/upgrade-station/UpgradeManager"
import { BuffPickup } from "./BuffPickup"

export class SpeedPickup extends BuffPickup {

    constructor(buffDuration: number) {
        super(buffDuration)
        this.displayText = "👟"
        this.popupTitle = "Speed Up!"
        const increase = UpgradeManager.getSpeedBoostIncrease()
        this.popupBody = `+${increase}% Speed\nDuration: ${buffDuration}s`
    }

    protected consumePickup(): void {
        super.consumePickup()

        UpgradeManager.setSpeedBoost(true)
    }

    protected onCleanup(): void {
        if (!this.consumed) return
        UpgradeManager.setSpeedBoost(false)
        super.onCleanup()
    }
}