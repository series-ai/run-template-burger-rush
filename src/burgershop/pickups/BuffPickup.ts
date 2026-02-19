import { UpgradeManager } from "@game/upgrade-station/UpgradeManager"
import { Pickup } from "./Pickup"
import { Timer } from "@game/Timer"
import { BurgerShopDirectory } from "@game/BurgerShopDirectory"
import { GameObject } from "@series-inc/rundot-3d-engine"
import * as THREE from "three"
import { PickupManager } from "./PickupManager"

export class BuffPickup extends Pickup {
    protected buffTimer!: Timer
    protected consumed: boolean = false
    private followObject?: GameObject
    private worldPosition: THREE.Vector3 = new THREE.Vector3()

    constructor(buffDuration: number) {
        super()
        this.buffTimer = new Timer(buffDuration)
    }

    protected consumePickup(): void {
        if (this.consumed) return
        super.consumePickup()

        this.consumed = true
        const player = BurgerShopDirectory.getPlayer()
        if (player) {
            this.followObject = player
            this.worldPosition.copy(this.followObject.position)
            this.updateWorldPosition(this.followObject)
        }

        this.displayPlane?.position.set(-2.5, 4, 0)
        this.displayPlane?.rotation.copy(this.camera.rotation)
        this.displayPlane?.scale.set(0.5, 0.5, 0.5)

        this.deathTimer = new Timer(this.buffTimer.duration)
        this.deathTimer.reset()

        this.interactionZone.setActive(false)

        PickupManager.addBuffPickup(this)
    }

    protected onCleanup(): void {
        if (!this.consumed) return
        PickupManager.removeBuffPickup(this)
        super.onCleanup()
    }

    public update(deltaTime: number): void {
        if (!this.consumed) {
            super.update(deltaTime)
            return
        }
        this.updateWorldPosition(this.followObject)
        this.gameObject.position.copy(this.worldPosition)

        this.deathTimer.tick(deltaTime)

        this.buffTimer.tick(deltaTime)
        if (this.buffTimer.isDone() || this.deathTimer.isDone()) {
            UpgradeManager.setSpeedBoost(false)
            this.destroy()
        }

        this.renderImagesToCanvas()
        this.renderTextToCanvas()
    }

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

            this.worldPosition.y += 1
            // Position updated silently
        }
    }
}