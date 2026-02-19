import * as THREE from "three"
import { BurgerShopDirectory } from "@game/BurgerShopDirectory"
import { Employee } from "@game/employee"
import { EmployeeState } from "@game/employee/Employee"
import { Table } from "@game/Table"
import { Component } from "@series-inc/rundot-3d-engine"
import { ItemTypes } from "@game/inventory"
import { BathroomStall } from "@game/bathroom-station/BathroomStall"
import { ProductionStation, ItemDropoffZone } from "@game/shared"

/**
 * Types of tasks employees can be assigned
 */
enum TaskType {
    DELIVER_ITEMS = "deliver_items",
    CLEAN_TABLE = "clean_table",
    CLEAN_BATHROOM = "clean_bathroom",
}

/**
 * Weight configuration for task selection
 * Higher weight = more likely to be selected
 */
const TASK_WEIGHTS: Record<TaskType, number> = {
    [TaskType.DELIVER_ITEMS]: 12,
    [TaskType.CLEAN_TABLE]: 7,
    [TaskType.CLEAN_BATHROOM]: 1,
}

interface AvailableTask {
    type: TaskType
    weight: number
}

export class EmployeeManager extends Component {
    private idleEmployees: Employee[] = []

    private tablesBeingCleaned: Set<Table> = new Set()
    private employeeToTableMap: Map<Employee, Table> = new Map()
    private bathroomStallsBeingCleaned: Set<BathroomStall> = new Set()
    private employeeToBathroomStallMap: Map<Employee, BathroomStall> = new Map()

    private taskTimer: number = 0
    private readonly TASK_INTERVAL = 0.5

    constructor() {
        super()
    }

    public addIdleEmployee(employee: Employee, previousState: EmployeeState) {
        if (!this.idleEmployees.includes(employee)) {
            this.idleEmployees.push(employee)
        }

        switch (previousState) {
            case EmployeeState.DROPPING_OFF_TRASH:
            case EmployeeState.PICKING_UP_TRASH:
                const table = this.employeeToTableMap.get(employee)
                if (table) {
                    this.tablesBeingCleaned.delete(table)
                    this.employeeToTableMap.delete(employee)
                }
                break
        }
    }

    public tryCleanOtherStall(employee: Employee): boolean {
        // Check if there are any dirty bathrooms not being cleaned
        for (const bathroomStation of BurgerShopDirectory.getActiveBathroomStations()) {
            const dirtyStalls = bathroomStation.getDirtyStalls()
            for (const dirtyStall of dirtyStalls) {
                if (this.bathroomStallsBeingCleaned.has(dirtyStall)) {
                    continue
                }

                if (employee) {
                    employee.assignToCleanStall(dirtyStall)
                    this.bathroomStallsBeingCleaned.add(dirtyStall)
                    this.employeeToBathroomStallMap.set(employee, dirtyStall)
                    return true
                }
            }
        }

        return false
    }

    public reportStallClean(employee: Employee, bathroomStall: BathroomStall): void {
        this.bathroomStallsBeingCleaned.delete(bathroomStall)
        this.employeeToBathroomStallMap.delete(employee)
    }

    protected onCreate(): void {
        this.taskTimer = this.TASK_INTERVAL
    }

    public update(deltaTime: number): void {
        this.taskTimer -= deltaTime
        if (this.taskTimer <= 0) {
            this.taskTimer = this.TASK_INTERVAL
            this.assignTasks()
        }
    }

    private assignTasks() {
        // Check if there are NO idle employees
        if (this.idleEmployees.length === 0) {
            return
        }

        // Check which task types are available (one entry per type)
        const availableTasks: AvailableTask[] = []

        // Check if any items available for delivery
        if (this.hasItemsToDeliver()) {
            availableTasks.push({
                type: TaskType.DELIVER_ITEMS,
                weight: TASK_WEIGHTS[TaskType.DELIVER_ITEMS],
            })
        }

        // Check if any dirty tables need cleaning
        if (this.hasDirtyTable()) {
            availableTasks.push({
                type: TaskType.CLEAN_TABLE,
                weight: TASK_WEIGHTS[TaskType.CLEAN_TABLE],
            })
        }

        // Check if any dirty bathroom stalls need cleaning
        if (this.hasDirtyBathroomStall()) {
            availableTasks.push({
                type: TaskType.CLEAN_BATHROOM,
                weight: TASK_WEIGHTS[TaskType.CLEAN_BATHROOM],
            })
        }

        // If no tasks available, nothing to do
        if (availableTasks.length === 0) {
            return
        }

        // Select a task TYPE using weighted random selection
        const selectedTask = this.selectWeightedRandomTask(availableTasks)
        if (!selectedTask) {
            return
        }

        // Find the best target for the selected task type and execute
        this.executeTask(selectedTask.type)
    }

    /**
     * Check if there are any items available for delivery
     */
    private hasItemsToDeliver(): boolean {
        for (const station of BurgerShopDirectory.getActiveBurgerStations()) {
            if (station.hasItems()) {
                return true
            }
        }
        return false
    }

    /**
     * Check if there's at least one dirty table not being cleaned
     */
    private hasDirtyTable(): boolean {
        for (const table of BurgerShopDirectory.getActiveTables()) {
            if (table.hasTrash() && !this.tablesBeingCleaned.has(table)) {
                return true
            }
        }
        return false
    }

    /**
     * Check if there's at least one dirty bathroom stall not being cleaned
     */
    private hasDirtyBathroomStall(): boolean {
        for (const bathroomStation of BurgerShopDirectory.getActiveBathroomStations()) {
            for (const stall of bathroomStation.getDirtyStalls()) {
                if (!this.bathroomStallsBeingCleaned.has(stall)) {
                    return true
                }
            }
        }
        return false
    }

    /**
     * Select a task using weighted random selection
     */
    private selectWeightedRandomTask(tasks: AvailableTask[]): AvailableTask | null {
        if (tasks.length === 0) {
            return null
        }

        // Calculate total weight
        const totalWeight = tasks.reduce((sum, task) => sum + task.weight, 0)
        
        // Generate random number between 0 and total weight
        const roll = Math.random() * totalWeight
        
        // Find which task the roll lands on
        let cumulativeWeight = 0
        for (const task of tasks) {
            cumulativeWeight += task.weight
            if (roll < cumulativeWeight) {
                return task
            }
        }

        // Fallback to first task (shouldn't happen)
        return tasks[0]
    }

    /**
     * Execute the selected task type by finding the best target and assigning closest employee
     */
    private executeTask(taskType: TaskType): void {
        switch (taskType) {
            case TaskType.DELIVER_ITEMS: {
                // Find which checkout needs items most and which production station to pick from
                const deliveryTask = this.findDeliveryTask(
                    BurgerShopDirectory.getActiveBurgerStations()
                )
                if (!deliveryTask) return

                const targetPosition = deliveryTask.station.getGameObject().getWorldPosition(new THREE.Vector3())
                const employee = this.findClosestEmployee(targetPosition)
                if (employee) {
                    employee.assignToPickupItems(deliveryTask.station, deliveryTask.dropoffZone)
                    this.removeFromIdleList(employee)
                }
                break
            }

            case TaskType.CLEAN_TABLE: {
                // Find closest dirty table to any idle employee
                const table = this.findClosestDirtyTable()
                if (!table) return

                const targetPosition = table.getGameObject().getWorldPosition(new THREE.Vector3())
                const employee = this.findClosestEmployee(targetPosition)
                if (employee) {
                    this.tablesBeingCleaned.add(table)
                    this.employeeToTableMap.set(employee, table)
                    employee.assignToCleanTable(table)
                    this.removeFromIdleList(employee)
                }
                break
            }

            case TaskType.CLEAN_BATHROOM: {
                // Find closest dirty stall to any idle employee
                const stall = this.findClosestDirtyStall()
                if (!stall) return

                const targetPosition = stall.getEmployeeTarget().getWorldPosition(new THREE.Vector3())
                const employee = this.findClosestEmployee(targetPosition)
                if (employee) {
                    employee.assignToCleanStall(stall)
                    this.bathroomStallsBeingCleaned.add(stall)
                    this.employeeToBathroomStallMap.set(employee, stall)
                    this.removeFromIdleList(employee)
                }
                break
            }
        }
    }

    /**
     * Find the closest dirty table to any idle employee
     */
    private findClosestDirtyTable(): Table | null {
        let closestTable: Table | null = null
        let closestDistance = Infinity

        for (const table of BurgerShopDirectory.getActiveTables()) {
            if (!table.hasTrash() || this.tablesBeingCleaned.has(table)) {
                continue
            }

            const tablePosition = table.getGameObject().getWorldPosition(new THREE.Vector3())
            
            // Find distance to closest idle employee
            for (const employee of this.idleEmployees) {
                const employeePosition = employee.getGameObject().getWorldPosition(new THREE.Vector3())
                const distance = employeePosition.distanceTo(tablePosition)
                if (distance < closestDistance) {
                    closestDistance = distance
                    closestTable = table
                }
            }
        }

        return closestTable
    }

    /**
     * Find the closest dirty bathroom stall to any idle employee
     */
    private findClosestDirtyStall(): BathroomStall | null {
        let closestStall: BathroomStall | null = null
        let closestDistance = Infinity

        for (const bathroomStation of BurgerShopDirectory.getActiveBathroomStations()) {
            for (const stall of bathroomStation.getDirtyStalls()) {
                if (this.bathroomStallsBeingCleaned.has(stall)) {
                    continue
                }

                const stallPosition = stall.getEmployeeTarget().getWorldPosition(new THREE.Vector3())
                
                // Find distance to closest idle employee
                for (const employee of this.idleEmployees) {
                    const employeePosition = employee.getGameObject().getWorldPosition(new THREE.Vector3())
                    const distance = employeePosition.distanceTo(stallPosition)
                    if (distance < closestDistance) {
                        closestDistance = distance
                        closestStall = stall
                    }
                }
            }
        }

        return closestStall
    }

    /**
     * Find which production station to pick up from AND where to deliver,
     * based on which checkout station has the lowest inventory.
     */
    private findDeliveryTask(stations: ProductionStation[]): { station: ProductionStation; dropoffZone: ItemDropoffZone } | null {
        // Collect ALL checkout needs with their dropoff zones
        const checkoutNeeds: { 
            itemType: string
            inventoryCount: number
            dropoffZone: ItemDropoffZone 
        }[] = []

        // Regular checkout stations (burger checkout, shake checkout)
        for (const checkout of BurgerShopDirectory.getActiveCheckoutStations()) {
            checkoutNeeds.push({
                itemType: checkout.getItemType(),
                inventoryCount: checkout.getInventoryCount(),
                dropoffZone: checkout.getItemDropoff(),
            })
        }

        // Drive-thru (burgers only)
        for (const driveThru of BurgerShopDirectory.getActiveDrivethrus()) {
            const dropoff = driveThru.getItemDropoff()
            if (dropoff) {
                checkoutNeeds.push({
                    itemType: ItemTypes.BURGER,
                    inventoryCount: driveThru.getInventoryCount(),
                    dropoffZone: dropoff,
                })
            }
        }

        // Self-checkout (burgers and shakes as separate entries)
        for (const selfCheckout of BurgerShopDirectory.getActiveSelfCheckoutStations()) {
            const burgerDropoff = selfCheckout.getItemDropoff(ItemTypes.BURGER)
            if (burgerDropoff) {
                checkoutNeeds.push({
                    itemType: ItemTypes.BURGER,
                    inventoryCount: selfCheckout.getInventoryCount(ItemTypes.BURGER),
                    dropoffZone: burgerDropoff,
                })
            }
            const shakeDropoff = selfCheckout.getItemDropoff(ItemTypes.SHAKE)
            if (shakeDropoff) {
                checkoutNeeds.push({
                    itemType: ItemTypes.SHAKE,
                    inventoryCount: selfCheckout.getInventoryCount(ItemTypes.SHAKE),
                    dropoffZone: shakeDropoff,
                })
            }
        }

        if (checkoutNeeds.length === 0) {
            return null
        }

        // Get production stations with items
        const stationsWithItems = stations.filter(station => station.hasItems())
        if (stationsWithItems.length === 0) {
            return null
        }

        // Build a set of item types we can actually deliver
        const availableItemTypes = new Set<string>()
        for (const station of stationsWithItems) {
            const items = station.getInventory().getAllItems()
            if (items.length > 0) {
                availableItemTypes.add(items[0].itemType)
            }
        }

        // Filter to only checkouts we can actually service
        const serviceableCheckouts = checkoutNeeds.filter(need => 
            availableItemTypes.has(need.itemType)
        )

        if (serviceableCheckouts.length === 0) {
            return null
        }

        // Find the minimum inventory count among serviceable checkouts
        const minInventory = Math.min(...serviceableCheckouts.map(c => c.inventoryCount))

        // Get all checkouts with the minimum inventory
        const lowestCheckouts = serviceableCheckouts.filter(c => c.inventoryCount === minInventory)

        // Randomly pick one of the lowest checkouts
        const selectedCheckout = lowestCheckouts[Math.floor(Math.random() * lowestCheckouts.length)]

        // Find a production station that has items of this type
        for (const station of stationsWithItems) {
            const items = station.getInventory().getAllItems()
            const itemType = items.length > 0 ? items[0].itemType : null
            if (itemType === selectedCheckout.itemType) {
                return {
                    station,
                    dropoffZone: selectedCheckout.dropoffZone,
                }
            }
        }

        return null
    }

    /**
     * Find the closest idle employee to a target position
     */
    private findClosestEmployee(targetPosition: THREE.Vector3): Employee | null {
        if (this.idleEmployees.length === 0) {
            return null
        }

        let closestEmployee: Employee | null = null
        let closestDistance = Infinity

        for (const employee of this.idleEmployees) {
            const employeePosition = employee.getGameObject().getWorldPosition(new THREE.Vector3())
            const distance = employeePosition.distanceTo(targetPosition)

            if (distance < closestDistance) {
                closestDistance = distance
                closestEmployee = employee
            }
        }

        return closestEmployee
    }

    /**
     * Remove an employee from the idle list
     */
    private removeFromIdleList(employee: Employee): void {
        const index = this.idleEmployees.indexOf(employee)
        if (index !== -1) {
            this.idleEmployees.splice(index, 1)
        }
    }
}
