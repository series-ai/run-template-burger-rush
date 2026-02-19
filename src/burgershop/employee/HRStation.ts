import * as THREE from "three"
import { Component, GameObject, InteractionZone } from "@series-inc/rundot-3d-engine"
import { StowKitSystem, ParticleSystemPrefabComponent, PrefabLoader, PlayAudioOneShot2D, Main2DAudioBank } from "@series-inc/rundot-3d-engine/systems"
import { AnimationUtils } from "@game/shared"
import { PlayerComponent } from "@game"
import {
    CostManager,
    IUnlockable,
    PurchaseArea,
    UnlockManager,
    GroundLabel,
    ArrowDirection,
    LabelSize,
} from "@game/money"
import { EmployeeSpawner } from "@game/employee"
import { HRUpgradeManager } from "./HRUpgradeManager"
import { EmployeeInventory } from "./EmployeeInventory"
import { Employee } from "./Employee"
import { GenericUpgradePanel } from "../ui/GenericUpgradePanel"
import { PrefabInstance, BoxComponentJSON } from "@game/prefabs"
import { EMPLOYEE_SPEEDS, EMPLOYEE_INVENTORY_SIZES } from "../BurgerShopBalanceConfig"

// Money is handled inside the generic panel

/**
 * Three.js version of the HR station. For now, this implements:
 * - Purchase/unlock flow
 * - Visual HR office furniture (desk, bookshelf, plant)
 * - Interaction zone at the desk
 * - Text-only upgrades shown in a modal (buttons disabled; display-only)
 */
export class HRStation extends Component implements IUnlockable {
    private stationComponentsObject!: GameObject // container for furniture and zones
    private readonly zonePrefabInstance: PrefabInstance
    private readonly labelPrefabInstance: PrefabInstance | null
    private interactionZone!: InteractionZone
    private playersInZone: Set<GameObject> = new Set()

    // Purchase system
    private purchaseArea!: PurchaseArea
    private purchaseAreaObject: GameObject | null = null
    private costKey: string
    private labelDirection: ArrowDirection

    private uiElement: GenericUpgradePanel | null = null
    private isUIVisible: boolean = false
    private isAcquired: boolean = false
    private spawner?: EmployeeSpawner
    private hrManager!: HRUpgradeManager
    private prefabInstance: PrefabInstance

    constructor(prefab: PrefabInstance, costKey: string, labelDirection: ArrowDirection = "up") {
        super()
        this.prefabInstance = prefab
        this.costKey = costKey
        this.labelDirection = labelDirection

        // interaction_zone is a sibling of hr_station_display, not a child
        this.zonePrefabInstance = prefab.getDescendantByPathOrThrow(
            "/interaction_zone",
        )

        // label is optional - used for ground label
        this.labelPrefabInstance = prefab.getDescendantByPath("/label") ?? null
    }

    protected onCreate(): void {
        const displayPrefabInstance = this.prefabInstance.getDescendantByPath(
            "/hr_station_display",
        )
        if (!displayPrefabInstance) {
            throw new Error("Failed to find HR station display object")
        }

        this.stationComponentsObject = displayPrefabInstance.gameObject
        this.gameObject.add(this.stationComponentsObject)

        // Create employee spawner
        this.createEmployeeSpawner()
        // Setup interaction zone (hidden until acquired)
        this.setupInteractionZone()
        // Setup purchase area (created internally like Table)
        this.setupPurchaseArea()
        // Setup ground label if prefab has label node
        this.setupGroundLabel()

        // Initially hidden until unlocked & acquired
        this.stationComponentsObject.setEnabled(false)
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(false)
        }
    }

    protected onCleanup(): void {
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
            this.purchaseAreaObject = null
        }
        if (this.uiElement) {
            this.uiElement.close()
            this.uiElement = null
        }
        this.playersInZone.clear()
    }

    // IUnlockable
    public getUnlockableId(): string {
        return this.getGameObject().name
    }
    public getDisplayName(): string {
        return "HR Station"
    }
    public getCost(): number {
        return CostManager.getCost("hr_station")
    }

    public unlock(): void {
        // Enable purchase area
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(true)
        }
    }

    public acquire(fromStorage: boolean = false): void {
        // HR Station acquired
        // Note: UnlockManager.acquire() is called by the PurchaseArea, not here
        this.isAcquired = true

        this.stationComponentsObject.setEnabled(true)

        // Show the ground label now that it's acquired
        if (this.labelPrefabInstance) {
            this.labelPrefabInstance.gameObject.visible = true
        }

        // Animate the HR station bouncing in (but not when loading from storage)
        if (!fromStorage) {
            AnimationUtils.animateIn(this.stationComponentsObject)
        }

        // Remove the purchase area since it's no longer needed
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
            this.purchaseAreaObject = null
        }

        // Apply existing HR upgrades
        // Update employee inventory size to match saved upgrades
        EmployeeInventory.maxInventorySize =
            this.hrManager.getEmployeeInventorySize()

        // Update employee speed to match saved upgrades
        Employee.speed = this.hrManager.getEmployeeSpeed()

        // If HR upgrades indicate existing hires, spawn them now
        const count = this.hrManager.getEmployeeCount()
        // HRStation acquiring employees
        if (this.spawner && count > 0) {
            // Spawn to match count
            for (let i = 0; i < count; i++) this.spawner.hireEmployee()
        }
        
        // If player is already in the interaction zone, show UI immediately
        if (this.playersInZone.size > 0) {
            this.showUI()
        }
    }

    private createEmployeeSpawner(): void {
        // Attach employee spawner under HR office root for hires
        const spawnerObject = new GameObject("EmployeeSpawner")
        this.stationComponentsObject.add(spawnerObject)
        this.spawner = spawnerObject.addComponent(new EmployeeSpawner())
    }

    private setupPurchaseArea(): void {
        this.purchaseAreaObject = new GameObject("HRStationPurchaseArea")
        this.purchaseAreaObject.position
            .copy((this.gameObject as GameObject).position)
            .add(new THREE.Vector3(0, 0, -0.5))

        this.purchaseArea = new PurchaseArea(
            CostManager.getCost(this.costKey),
            new THREE.Vector2(3.5, 3.5),
            "HR",
            () => UnlockManager.acquire(this),
        )

        this.purchaseAreaObject.addComponent(this.purchaseArea)
    }

    private setupGroundLabel(): void {
        if (!this.labelPrefabInstance) return

        const groundLabel = new GroundLabel("HR", this.labelDirection, new THREE.Vector2(2, 2), "large")
        this.labelPrefabInstance.gameObject.addComponent(groundLabel)

        // Hide label initially - will be shown when acquired
        this.labelPrefabInstance.gameObject.visible = false
    }

    private setupInteractionZone(): void {
        const boxData = this.zonePrefabInstance.prefabNode.getComponentData<BoxComponentJSON>("box")
        if (!boxData) {
            throw new Error("HR Station interaction_zone prefab must have a box component")
        }

        this.interactionZone = new InteractionZone(
            (other) => this.onPlayerEnter(other),
            (other) => this.onPlayerExit(other),
            { 
                width: boxData.size[0], 
                depth: boxData.size[2], 
                show: false 
            },
        )
        this.zonePrefabInstance.gameObject.addComponent(this.interactionZone)
    }

    private onPlayerEnter(other: GameObject): void {
        const player = other.getComponent(PlayerComponent)
        if (!player) return
        
        // Always track players in zone (even before acquisition)
        this.playersInZone.add(other)
        
        // Only show UI if acquired
        if (this.isAcquired) {
            this.showUI()
        }
    }

    private onPlayerExit(other: GameObject): void {
        const player = other.getComponent(PlayerComponent)
        if (!player) return
        this.playersInZone.delete(other)
        if (this.playersInZone.size === 0) {
            this.hideUI()
        }
    }

    private showUI(): void {
        if (this.isUIVisible) return

        const panel = GenericUpgradePanel.open({
            title: "Employees",
            upgrades: [
                {
                    id: "employees",
                    label: "Hire",
                    getCurrentLevel: () => this.hrManager.getEmployeeCount(),
                    canUpgrade: () => this.hrManager.canPurchaseEmployee(),
                    getCost: () => this.hrManager.getEmployeeCost(),
                    getLevel: () => {
                        const count = this.hrManager.getEmployeeCount()
                        return `Level ${count + 1}`
                    },
                    getDescription: () => {
                        const count = this.hrManager.getEmployeeCount()
                        return `${count}/${this.hrManager.getMaxEmployees()} employees`
                    },
                    getBenefit: () => {
                        if (!this.hrManager.canPurchaseEmployee()) return ""
                        return "+1 employee"
                    },
                    onUpgrade: async () => {
                        await this.hrManager.purchaseEmployee()
                        // Spawn a new employee in the HR room
                        const newEmployee = this.spawner?.hireEmployee()
                        // Spawn upgrade effect above the newly hired employee
                        if (newEmployee) {
                            this.spawnUpgradeEffectAboveEmployee(newEmployee)
                        }
                    },
                },
                {
                    id: "employee_speed",
                    label: "Speed",
                    getCurrentLevel: () =>
                        this.hrManager.getEmployeeSpeedLevel(),
                    canUpgrade: () => this.hrManager.canUpgradeEmployeeSpeed(),
                    getCost: () => this.hrManager.getEmployeeSpeedCost(),
                    getLevel: () => {
                        const level = this.hrManager.getEmployeeSpeedLevel()
                        return `Level ${level + 1}`
                    },
                    getDescription: () => {
                        const currentSpeed = this.hrManager.getEmployeeSpeed()
                        const speedPercent = (currentSpeed / EMPLOYEE_SPEEDS[0]) * 100
                        return `${speedPercent.toFixed(0)}% move speed`
                    },
                    getBenefit: () => {
                        const level = this.hrManager.getEmployeeSpeedLevel()
                        if (level >= EMPLOYEE_SPEEDS.length - 1) return ""
                        const nextSpeed = EMPLOYEE_SPEEDS[level + 1]
                        const currentSpeed = EMPLOYEE_SPEEDS[level]
                        const increase = ((nextSpeed - currentSpeed) / EMPLOYEE_SPEEDS[0]) * 100
                        return `+${increase.toFixed(0)}% move speed`
                    },
                    onUpgrade: async () => {
                        await this.hrManager.upgradeEmployeeSpeed()
                        // Update the static speed for all employees
                        Employee.speed = this.hrManager.getEmployeeSpeed()
                        // Spawn upgrade effect above all employees
                        this.spawnUpgradeEffectAboveAllEmployees()
                    },
                },
                {
                    id: "employee_inventory",
                    label: "Carry",
                    getCurrentLevel: () =>
                        this.hrManager.getEmployeeInventoryLevel(),
                    canUpgrade: () =>
                        this.hrManager.canUpgradeEmployeeInventory(),
                    getCost: () => this.hrManager.getEmployeeInventoryCost(),
                    getLevel: () => {
                        const level = this.hrManager.getEmployeeInventoryLevel()
                        return `Level ${level + 1}`
                    },
                    getDescription: () => {
                        const currentSize =
                            this.hrManager.getEmployeeInventorySize()
                        return `Carry ${currentSize} items`
                    },
                    getBenefit: () => {
                        const level = this.hrManager.getEmployeeInventoryLevel()
                        if (level >= EMPLOYEE_INVENTORY_SIZES.length - 1) return ""
                        const nextSize = EMPLOYEE_INVENTORY_SIZES[level + 1]
                        const currentSize = EMPLOYEE_INVENTORY_SIZES[level]
                        return `+${nextSize - currentSize} capacity`
                    },
                    onUpgrade: async () => {
                        await this.hrManager.upgradeEmployeeInventory()
                        // Update the static inventory size for all employees
                        EmployeeInventory.maxInventorySize =
                            this.hrManager.getEmployeeInventorySize()
                        // Spawn upgrade effect above all employees
                        this.spawnUpgradeEffectAboveAllEmployees()
                    },
                },
            ],
        })
        this.uiElement = panel
        this.isUIVisible = true
    }

    private hideUI(): void {
        if (!this.isUIVisible) return
        if (this.uiElement) {
            this.uiElement.close()
            this.uiElement = null
        }
        delete (window as any).closeUpgradeUI
        this.isUIVisible = false
    }

    /**
     * Get the HR manager instance for external access (e.g. tutorial checks)
     */
    public getHRManager(): HRUpgradeManager {
        return this.hrManager
    }

    /**
     * Initialize the HR manager
     * Must be called after onCreate() to load saved data
     * @deprecated Use setHRManager() instead for faster startup
     */
    public async initialize(): Promise<void> {
        this.hrManager = new HRUpgradeManager()
        await this.hrManager.initialize()
    }

    /**
     * Set a pre-initialized HR manager (for faster startup)
     */
    public setHRManager(manager: HRUpgradeManager): void {
        this.hrManager = manager
    }

    /**
     * Get highlight position for tutorial (use purchase area if available, otherwise HR desk)
     */
    public getHighlightPosition(outPosition: THREE.Vector3): void {
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.getWorldPosition(outPosition)
        } else {
            this.gameObject.getWorldPosition(outPosition)
        }
    }

    /**
     * Spawn the upgrade particle effect above a specific employee
     */
    private spawnUpgradeEffectAboveEmployee(employee: Employee): void {
        // Play character upgrade sound
        try {
            PlayAudioOneShot2D(Main2DAudioBank, "character_upgrade")
        } catch (error) {
            console.warn("Failed to play character_upgrade sound:", error)
        }

        this.spawnParticleEffectAboveEmployee(employee)
    }

    /**
     * Spawn the particle effect above an employee (internal, no sound)
     */
    private spawnParticleEffectAboveEmployee(employee: Employee): void {
        const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
        const upgradePrefab = prefabCollection.getPrefabByName("pfx_character_upgrade")

        if (!upgradePrefab) {
            console.warn("pfx_character_upgrade prefab not found")
            return
        }

        const employeeGameObject = employee.getGameObject()
        if (!employeeGameObject) return

        // Create a temporary holder positioned 2 meters above the employee
        const effectHolder = new GameObject("UpgradeEffectHolder")
        const employeeWorldPos = new THREE.Vector3()
        employeeGameObject.getWorldPosition(employeeWorldPos)
        effectHolder.position.copy(employeeWorldPos)
        effectHolder.position.y += 2

        // Instantiate the prefab
        const instance = PrefabLoader.instantiatePrefab(upgradePrefab, effectHolder)
        const particleComponent = instance.gameObject.getComponent(ParticleSystemPrefabComponent)

        if (particleComponent) {
            particleComponent.play()

            // Clean up the effect after 5 seconds (duration of the particle effect)
            setTimeout(() => {
                effectHolder.dispose()
            }, 5000)
        } else {
            effectHolder.dispose()
        }
    }

    /**
     * Spawn the upgrade particle effect above all active employees
     */
    private spawnUpgradeEffectAboveAllEmployees(): void {
        if (!this.spawner) return
        const employees = this.spawner.getActiveEmployees()
        if (employees.length === 0) return

        // Play character upgrade sound once for all employees
        try {
            PlayAudioOneShot2D(Main2DAudioBank, "character_upgrade")
        } catch (error) {
            console.warn("Failed to play character_upgrade sound:", error)
        }

        for (const employee of employees) {
            this.spawnParticleEffectAboveEmployee(employee)
        }
    }

    // Handlers managed by GenericUpgradePanel
}
