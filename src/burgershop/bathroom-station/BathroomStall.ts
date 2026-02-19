import { Component, GameObject, InteractionZone } from "@series-inc/rundot-3d-engine"
import { PrefabInstance, BoxComponentJSON } from "@game/prefabs"
import { Customer } from "../customer/Customer"
import { BathroomStation } from "./BathroomStation"
import { PlayerComponent } from "@game/PlayerComponent"
import { Employee } from "@game/employee"
import { Timer } from "@game/Timer"
import { CanPickupItems } from "@game/shared/CanPickupItems"
import { Trash } from "@game/Trash"
import * as THREE from "three"
import { BATHROOM_HEALTH_MAX, BATHROOM_HEALTH_MIN } from "@game/BurgerShopBalanceConfig"

export enum BathroomStallState {
    Available,
    InUse,
    Dirty
}

export class BathroomStall extends Component {
    private station: BathroomStation
    private customer: Customer | null = null
    private departingCustomer: Customer | null = null
    private state: BathroomStallState = BathroomStallState.Available
    
    private stallParent!: GameObject
    private stallCleanDisplay!: GameObject
    private stallDirtyDisplay!: GameObject
    private doorPivot!: GameObject
    private seatPivot!: GameObject
    
    // Station Components
    private interactionZone!: InteractionZone
    private interactionZoneBoxData: BoxComponentJSON | undefined
    private interactionZoneObject!: GameObject // Store reference for employee targeting
    private playersInZone: Set<GameObject> = new Set()
    private customersInZone: Set<GameObject> = new Set()

    private currentHealth: number = BATHROOM_HEALTH_MIN

    private doorRotationTarget: number = 0

    constructor(station: BathroomStation, stallParent: PrefabInstance) {
        super()
        this.station = station
        this.stallParent = stallParent.gameObject
        this.stallCleanDisplay = stallParent.getDescendantByPathOrThrow(`/clean`).gameObject
        this.stallDirtyDisplay = stallParent.getDescendantByPathOrThrow(`/dirty`).gameObject
        this.doorPivot = stallParent.getDescendantByPathOrThrow(`/doorpivot`).gameObject
        const trashPickupArea = stallParent.getDescendantByPathOrThrow(`/trash_pickup_area`)
        this.interactionZoneObject = trashPickupArea.gameObject
        this.interactionZoneBoxData = trashPickupArea.prefabNode.getComponentData<BoxComponentJSON>("box")
        this.seatPivot = stallParent.getDescendantByPathOrThrow(`/seat_pos`).gameObject
    }

    protected onCreate(): void {
        this.setState(BathroomStallState.Available)
        this.currentHealth = BATHROOM_HEALTH_MIN + Math.floor(Math.random() * (BATHROOM_HEALTH_MAX - BATHROOM_HEALTH_MIN))
        this.setupInteractionZone()
    }

    public isAvailable(): boolean {
        return this.state === BathroomStallState.Available && this.customer === null
    }

    public isDirty(): boolean {
        return this.state === BathroomStallState.Dirty
    }

    public getEmployeeTarget(): GameObject {
        return this.interactionZoneObject
    }

    public getStallParent(): GameObject {
        return this.stallParent
    }

    public getCustomer(): Customer | null {
        return this.customer
    }

    public assignCustomer(customer: Customer | null): void {
        this.customer = customer
    }

    public getSeatPivot(): GameObject {
        return this.seatPivot
    }

    public setState(state: BathroomStallState): void {
        this.state = state
        
        if (this.state === BathroomStallState.Dirty) {
            this.stallDirtyDisplay.setEnabled(true)
            this.stallCleanDisplay.setEnabled(false)
        } else {
            this.stallCleanDisplay.setEnabled(true)
            this.stallDirtyDisplay.setEnabled(false)
        }
    }

    public customerFinished(): void {
        this.departingCustomer = this.customer
        this.customer = null
        this.station.addTip()

        this.currentHealth--
        
        if (this.currentHealth <= 0) {
            this.setState(BathroomStallState.Dirty)
        }
        else {
            this.setState(BathroomStallState.Available)
        }

    }

    public update(deltaTime: number): void {
        this.tryGiveTrashToPlayers()

        if (this.state === BathroomStallState.Dirty) {
            this.doorRotationTarget = 0
        }
        else if (this.state === BathroomStallState.InUse || !this.customerNearDoor()) {
            this.doorRotationTarget = Math.PI / 2
        }
        else {
            this.doorRotationTarget = 0
        }

        const currentRotation = this.doorPivot.rotation.y
        const rotationStep = this.doorRotationTarget - currentRotation
        if (Math.abs(rotationStep) < 0.08) {
            this.doorPivot.rotation.y = this.doorRotationTarget
        } else {
            this.doorPivot.rotation.y += Math.sign(rotationStep) * deltaTime * 3.5
        }
    }

    protected onCleanup(): void {
        this.stallParent.dispose()
        this.stallCleanDisplay.dispose()
        this.stallDirtyDisplay.dispose()
        this.interactionZoneObject.dispose()

        this.playersInZone.clear()
    }

    private customerNearDoor(): boolean {
        const customerToCheck = this.departingCustomer?.getGameObject() ?? this.customer?.getGameObject()
        if (customerToCheck === undefined || customerToCheck === null) {
            return false
        }

        const doorPosition = new THREE.Vector3()
        this.doorPivot.getWorldPosition(doorPosition)
        doorPosition.y = 0

        const customerPosition = new THREE.Vector3()
        customerToCheck.getWorldPosition(customerPosition)
        customerPosition.y = 0

        const distance = customerPosition.distanceTo(doorPosition)

        if (distance > 5) {
            this.departingCustomer = null
        }

        return distance < 2.3
    }
    
    private tryGiveTrashToPlayers(): void {
        if (this.playersInZone.size === 0 || this.state !== BathroomStallState.Dirty) {
            return
        }

        for (const playerGameObject of this.playersInZone) {
            const playerComponent =
                playerGameObject.getComponent(PlayerComponent)
            const employee = playerGameObject.getComponent(Employee)
            if (!playerComponent && !employee) continue

            // For employees, check if they have pickup permission for trash
            if (employee) {
                const canPickupItems = playerGameObject.getComponent(CanPickupItems)
                if (!canPickupItems || !canPickupItems.canPickup(Trash.ITEM_TYPE)) {
                    continue // Skip employees without permission for trash
                }
            }

            const targetInventory = playerComponent
                ? playerComponent.getInventory()
                : employee?.getInventory()
            if (!targetInventory || targetInventory.isFull()) continue

            if (targetInventory.hasItemsOtherThan(Trash.ITEM_TYPE)) continue

            const trashGameObject = new GameObject("Trash")
            const worldPos = new THREE.Vector3()
            this.stallParent.getWorldPosition(worldPos)
            trashGameObject.position.copy(worldPos)

            const trashComponent = new Trash()
            trashGameObject.addComponent(trashComponent)

            if (trashComponent) {
                const success = targetInventory.addItemAnimated(trashComponent)
                if (!success) {
                    trashGameObject.dispose()
                } else {
                    // Possibly add "pick up trash" from bathroom tutorial step?
                    /*// Record trash pickup from table for tutorial tracking
                    const tutorialSystem = BurgerShopDirectory.getTutorialSystem()
                    if (tutorialSystem) {
                        tutorialSystem.getTracker().recordTrashPickupFromTable()
                    }*/
                }
                this.setState(BathroomStallState.Available)
                this.currentHealth = BATHROOM_HEALTH_MIN + Math.floor(Math.random() * (BATHROOM_HEALTH_MAX - BATHROOM_HEALTH_MIN))
                break
            }
        }
    }
    
    private setupInteractionZone(): void {
        this.interactionZone = new InteractionZone(
            (other: GameObject) => this.onInteractionZoneEnter(other),
            (other: GameObject) => this.onInteractionZoneExit(other),
            {
                width: this.interactionZoneBoxData?.size[0] ?? 4,
                depth: this.interactionZoneBoxData?.size[2] ?? 4,
                show: false,
            },
        )

        this.interactionZoneObject.addComponent(this.interactionZone)
    }

    private onInteractionZoneEnter(gameObject: GameObject): void {
        const playerComponent = gameObject.getComponent(PlayerComponent)
        const employee = gameObject.getComponent(Employee)

        if (playerComponent || employee) {
            this.playersInZone.add(gameObject)
        }

    }

    private onInteractionZoneExit(gameObject: GameObject): void {
        const playerComponent = gameObject.getComponent(PlayerComponent)
        const employee = gameObject.getComponent(Employee)

        if (playerComponent || employee) {
            this.playersInZone.delete(gameObject)
        }
    }
}
