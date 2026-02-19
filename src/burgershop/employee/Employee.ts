import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { EmployeeInventory } from "./EmployeeInventory"
import { HasInventory, ItemTypes } from "@game/inventory"
import { Burger } from "@game/burger-station"
import { Trash } from "../Trash"
import { TrashCan } from "../TrashCan"
import { BurgerShopDirectory, Table } from "@game"
import { ProductionStation, ItemDropoffZone } from "@game/shared"
import { NavAgent } from "@series-inc/rundot-3d-engine/systems"
import { EmployeeManager } from "./EmployeeManager"
import { CanPickupItems } from "../shared/CanPickupItems"
import { DeliveryTarget } from "../shared/DeliveryTarget"
import {
    RigidBodyComponentThree,
    RigidBodyType,
    ColliderShape,
    createCollisionGroup,
} from "@series-inc/rundot-3d-engine/systems"
import { BurgerCharacterDisplay, BurgerCharacterAnimator } from "../character"
import { BurgerShopCollisionGroups } from "../BurgerShopCollisionGroups"
import { EMPLOYEE_SPEEDS } from "../BurgerShopBalanceConfig"
import { BathroomStall } from "@game/bathroom-station/BathroomStall"

export enum EmployeeState {
    IDLE,
    PICKING_UP_ITEMS,
    DROPPING_OFF_ITEMS,
    PICKING_UP_TRASH,
    DROPPING_OFF_TRASH,
    CLEANING_BATHROOM,
}

export class Employee extends Component {
    private inventory!: EmployeeInventory
    private characterDisplay: BurgerCharacterDisplay | null = null
    private characterAnimator: BurgerCharacterAnimator | null = null

    private currentState: EmployeeState = EmployeeState.IDLE

    private navAgent!: NavAgent

    // Speed that can be modified by HR upgrades (direct value, not multiplier)
    public static speed: number = EMPLOYEE_SPEEDS[0]

    private employeeManager: EmployeeManager
    private tableToClean: Table | null = null
    private itemStationToPickup: ProductionStation | null = null
    private assignedDeliveryPosition: THREE.Vector3 | null = null

    private bathroomStallToClean: BathroomStall | null = null

    constructor(employeeManager: EmployeeManager) {
        super()
        this.employeeManager = employeeManager
    }

    // ====================================================================
    // SETUP FUNCTIONS (Initialization/Creation Time)
    // ====================================================================

    protected onCreate(): void {
        this.setupCharacterComponents()
        this.setupPhysicsBody()
        this.setupNavAgent()
        this.setupInventory()

        this.employeeManager.addIdleEmployee(this, this.currentState)
    }

    private setupCharacterComponents(): void {
        this.characterDisplay = new BurgerCharacterDisplay("stowkit://Character_Employee_01")
        this.gameObject.addComponent(this.characterDisplay)

        this.characterAnimator = new BurgerCharacterAnimator()
        this.gameObject.addComponent(this.characterAnimator)
    }

    private setupPhysicsBody(): void {
        const rigidBody = new RigidBodyComponentThree({
            type: RigidBodyType.KINEMATIC, // Kinematic - controlled by NavAgent, not physics
            shape: ColliderShape.CAPSULE, // Use capsule for character-like collision
            radius: 0.4, // Match visual mesh radius
            height: 3, // Match visual mesh height
            restitution: 0, // No bouncing
            friction: 0.0, // No friction - NavAgent controls movement

            // Lock rotations to keep upright
            lockRotationX: true,
            lockRotationY: false, // Allow Y rotation for turning
            lockRotationZ: true,

            // Lock Y translation to keep at ground level
            lockTranslationY: true,

            collisionGroups: createCollisionGroup(BurgerShopCollisionGroups.EMPLOYEES, BurgerShopCollisionGroups.SENSORS_ONLY),
        })
        this.gameObject.addComponent(rigidBody)
    }

    private setupNavAgent(): void {
        this.navAgent = new NavAgent()
        this.navAgent.moveSpeed = Employee.speed
        this.navAgent.arrivalDistance = 0.2
        this.gameObject.addComponent(this.navAgent)
    }

    private setupInventory(): void {
        this.inventory = new EmployeeInventory()
        this.gameObject.addComponent(this.inventory)

        // Add HasInventory component to expose inventory to other systems
        const hasInventory = new HasInventory(this.inventory)
        this.gameObject.addComponent(hasInventory)
    }

    // ====================================================================
    // EMPLOYEE MANAGER TASK ASSIGNMENTS
    // ====================================================================

    public assignToCleanTable(table: Table): void {
        this.tableToClean = table
        this.currentState = EmployeeState.PICKING_UP_TRASH
        
        // Grant permission to pick up only trash items
        this.gameObject.addComponent(new CanPickupItems([ItemTypes.TRASH]))
        
        this.navAgent.moveTo(table.getPickupPosition())
    }

    public assignToCleanStall(bathroomStall: BathroomStall): void {
        this.bathroomStallToClean = bathroomStall
        this.currentState = EmployeeState.CLEANING_BATHROOM

        // Grant permission to pick up only trash items
        if (!this.gameObject.hasComponent(CanPickupItems)) {
            this.gameObject.addComponent(new CanPickupItems([ItemTypes.TRASH]))
        }

        const target = new THREE.Vector3()
        bathroomStall.getEmployeeTarget().getWorldPosition(target)
        
        this.navAgent.moveTo(target)

        console.log("Employee assigned to clean stall ", bathroomStall.getGameObject().name)
    }

    public assignToPickupItems(itemStation: ProductionStation, dropoffZone: ItemDropoffZone): void {
        this.itemStationToPickup = itemStation
        // Get the delivery position from the dropoff zone for navigation
        this.assignedDeliveryPosition = dropoffZone.getInteractionZoneObject().getWorldPosition(new THREE.Vector3())
        this.currentState = EmployeeState.PICKING_UP_ITEMS
        
        // Grant permission to pick up only the item type from this station
        const inventory = itemStation.getInventory()
        const items = inventory.getAllItems()
        if (items.length > 0) {
            const itemType = items[0].itemType
            this.gameObject.addComponent(new CanPickupItems([itemType]))
        }

        // Set delivery target so employee only drops off at the assigned checkout
        this.gameObject.addComponent(new DeliveryTarget(dropoffZone))
        
        this.navAgent.moveTo(itemStation.getPickupPosition())
    }

    // ====================================================================
    // UPDATE FUNCTIONS
    // ====================================================================

    public update(deltaTime: number): void {
        // Update movement speed based on HR upgrade level
        this.navAgent.moveSpeed = Employee.speed

        this.updateAnimations()

        switch (this.currentState) {
            case EmployeeState.PICKING_UP_TRASH:
                if (this.inventory.getItemCount() !== 0) {
                    this.goToClosestTrashCan()
                }
                else if (!this.tableToClean?.hasTrash()) {
                    this.returnToIdle()
                }
                break
            case EmployeeState.DROPPING_OFF_TRASH:
                if (this.inventory.getItemCount() === 0) {
                    this.returnToIdle()
                }
                break
            case EmployeeState.PICKING_UP_ITEMS:
                // Stay at production station until inventory is full OR station is empty
                const inventoryFull = this.inventory.isFull()
                const stationEmpty = !this.itemStationToPickup?.hasItems()
                
                if (inventoryFull || stationEmpty) {
                    // Time to deliver - check if we have items to deliver
                    if (this.inventory.getItemCount() > 0 && this.assignedDeliveryPosition) {
                        this.navAgent.moveTo(this.assignedDeliveryPosition)
                        this.currentState = EmployeeState.DROPPING_OFF_ITEMS
                    } else {
                        // No items picked up, return to idle
                        this.returnToIdle()
                    }
                }
                break
            case EmployeeState.DROPPING_OFF_ITEMS:
                if (this.inventory.getItemCount() === 0) {
                    this.returnToIdle()
                }
                break
            case EmployeeState.CLEANING_BATHROOM:
                if (this.bathroomStallToClean != null && !this.bathroomStallToClean.isDirty()) {
                    this.employeeManager.reportStallClean(this, this.bathroomStallToClean)
                    this.bathroomStallToClean = null
                }
                if (this.inventory.isFull()) {
                    this.goToClosestTrashCan()
                    break
                }

                if (this.bathroomStallToClean == null && !this.employeeManager.tryCleanOtherStall(this)) {
                    if (this.inventory.getItemCount() !== 0) {
                        this.goToClosestTrashCan()
                    }
                    else {
                        this.returnToIdle()
                    }
                }

                break
            case EmployeeState.IDLE:
                break
        }
    }

    private goToClosestTrashCan(): void {
        const closestTrashCan = this.findClosestTrashCan()
        if (closestTrashCan) {
            this.currentState = EmployeeState.DROPPING_OFF_TRASH
            const interactionZone = closestTrashCan.getInteractionZoneObject()
            let target = new THREE.Vector3()
            interactionZone.getWorldPosition(target)
            this.navAgent.moveTo(target)
        }
        else {
            console.error("Employee has no trash can available")
            this.returnToIdle()
        }
    }

    /**
     * Find the closest trash can to the employee
     */
    private findClosestTrashCan(): TrashCan | null {
        const trashCans = BurgerShopDirectory.getActiveTrashCans()
        if (trashCans.length === 0) {
            return null
        }

        const employeePosition = new THREE.Vector3()
        this.gameObject.getWorldPosition(employeePosition)

        let closestTrashCan = trashCans[0]
        let closestDistance = Infinity

        for (const trashCan of trashCans) {
            const trashCanPosition = new THREE.Vector3()
            trashCan.getGameObject().getWorldPosition(trashCanPosition)
            
            const distance = employeePosition.distanceTo(trashCanPosition)
            if (distance < closestDistance) {
                closestDistance = distance
                closestTrashCan = trashCan
            }
        }

        return closestTrashCan
    }

    private returnToIdle(): void {
        // Remove pickup permissions when returning to idle
        const canPickupItems = this.gameObject.getComponent(CanPickupItems)
        if (canPickupItems) {
            this.gameObject.removeComponent(CanPickupItems)
        }

        // Remove delivery target restriction
        const deliveryTarget = this.gameObject.getComponent(DeliveryTarget)
        if (deliveryTarget) {
            this.gameObject.removeComponent(DeliveryTarget)
        }
        
        this.employeeManager.addIdleEmployee(this, this.currentState)
        this.currentState = EmployeeState.IDLE
        this.navAgent.stop()
    }

    /**
     * Update animations based on employee state and movement
     */
    private updateAnimations(): void {
        if (!this.characterAnimator) return

        // Get normalized movement speed (0-1) for smooth animation blending
        const movementSpeed = this.navAgent ? this.navAgent.getMovementSpeedNormalized() : 0.0

        // Determine if employee is carrying items (burgers or trash)
        const isCarrying = this.inventory && this.inventory.getItemCount() > 0

        // Update animation parameters using clean API
        this.characterAnimator.setMovementSpeed(movementSpeed) // Smooth blend between idle and walk
        this.characterAnimator.setCarrying(isCarrying)
    }

    public getInventory(): EmployeeInventory {
        return this.inventory
    }
}
