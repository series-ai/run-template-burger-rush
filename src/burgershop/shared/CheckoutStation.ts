import * as THREE from "three"
import { Component, GameObject, InteractionZone } from "@series-inc/rundot-3d-engine"
import { ItemDropoffZone, AnimationUtils } from "@game/shared"
import {
  StowKitSystem,
  Audio2D,
  ColliderShape,
  DynamicNavSystem,
  Particle,
  PrefabLoader,
  RigidBodyComponentThree,
  RigidBodyType,
  ParticleSystemPrefabComponent,
} from "@series-inc/rundot-3d-engine/systems"
import { BurgerShopDirectory, OrderIndicator, PlayerComponent } from "@game"
import type { ICanHaveCashier } from "@game/cashier"
import { Cashier } from "@game/cashier"
import { CostManager, IUnlockable, MoneyPile, PurchaseArea, UnlockManager, } from "@game/money"
import { LineOfCustomers } from "@game/customer"
import { Customer } from "../customer/Customer"
import { CanCheckout } from "@game/cashier/Cashier"
import { Timer } from "@game/Timer"
import { CheckoutStationConfig } from "./CheckoutStationConfig"
import { InteractionAreaDisplay } from "../checkout-station/InteractionAreaDisplay"
import { PrefabInstance } from "@game/prefabs"
import { CASHIER_CHECKOUT_SPEEDS, PLAYER_CHECKOUT_SPEED } from "../BurgerShopBalanceConfig"

/**
 * Checkout Station - Configurable checkout for any item type
 * Replaces item-specific checkout stations with a config-based approach
 */
export class CheckoutStation extends Component implements IUnlockable, ICanHaveCashier {
    private config: CheckoutStationConfig
    
    // Hierarchy containers
    private readonly stationDisplay: PrefabInstance
    private readonly stationComponentsObject: GameObject
    private readonly checkoutObject: GameObject

    // System components
    private itemDropoff!: ItemDropoffZone
    private checkoutZone!: InteractionZone
    private checkoutZoneObject!: GameObject
    private entitiesInCheckoutZone: Set<GameObject> = new Set()

    // Money pile system
    private moneyPile!: MoneyPile
    private moneyPileObject!: GameObject

    // Purchase system
    private purchaseArea!: PurchaseArea
    private purchaseAreaObject: GameObject | null = null

    // Customer line
    private customerLine!: LineOfCustomers

    // Cashier reference
    private cashier: Cashier | null = null

    // Transaction particle effects
    private transactionParticleComponent: ParticleSystemPrefabComponent | null = null
    private transactionParticleObject: GameObject | null = null

    // Audio component
    private audioComponent: Audio2D | null = null

    // Interaction area display
    private interactionAreaDisplay: InteractionAreaDisplay | null = null

    // Order indicator
    private orderIndicator!: OrderIndicator

    // Navigation obstacle tracking
    private hasNavigationObstacle: boolean = false

    // Checkout speed configuration
    private cashierCheckoutTime: number = CASHIER_CHECKOUT_SPEEDS[0]  // Updated via onCashierSpeedChanged
    private checkoutTimer = new Timer(this.cashierCheckoutTime)

    constructor(config: CheckoutStationConfig) {
        super()
        this.config = config
        this.stationDisplay = config.prefabInstance.getDescendantByPathOrThrow("/checkout_station_display")
        this.stationComponentsObject = this.stationDisplay.gameObject
        this.checkoutObject = this.stationDisplay.getDescendantByPathOrThrow("/restaurant_display_checkout").gameObject
    }

    protected onCreate(): void {
        this.setupMoneyPile()
        this.setupInteractionZones()
        this.setupCustomerLine()
        this.setupPurchaseArea()
        this.setupTransactionParticles()
        this.setupAudio()
        this.createOrderIndicator()

        // Start completely locked
        this.stationComponentsObject.setEnabled(false)
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(false)
        }
    }

    private createOrderIndicator(): void {
        this.orderIndicator = new OrderIndicator({
            burgerCount: 0,
            heightOffset: 3.0,
            itemIcon: this.config.itemIcon,
        })
        this.orderIndicator.attachTo(this.gameObject, BurgerShopDirectory.getMainCamera()!)
        this.orderIndicator.show()
    }
    
    private destroyOrderIndicator(): void {
        this.orderIndicator.dispose()
    }

    currentOrderIndicatorCount: number = -1
    private updateOrderIndicator(): void {
        if (this.customerLine.hasCustomerReachedOrderingPosition()) {
            this.orderIndicator.show()
            const frontCustomer = this.customerLine.getFrontCustomer();
            if (frontCustomer) {
                this.orderIndicator.update(frontCustomer, BurgerShopDirectory.getMainCamera()!)
                
                const ordercount = frontCustomer.getComponent(Customer)!.getItemsNeededCount()
                if (ordercount !== this.currentOrderIndicatorCount) {
                    this.currentOrderIndicatorCount = ordercount
                    this.orderIndicator.updateBurgerCount(ordercount)
                }
            }
            const allSeatsAreTaken = this.checkIfAllSeatsAreTaken()
            if (allSeatsAreTaken) {
              this.orderIndicator.showNoSeatsWarning()
            }
            else {
              this.orderIndicator.hideNoSeatsWarning()
            }
        }
        else {
            this.orderIndicator.hide()
        }
    }

    private checkIfAllSeatsAreTaken() {
      const allTables = BurgerShopDirectory.getActiveTables()
      const availableTables = allTables.filter((table) => table.isAvailable())
      return availableTables.length === 0
    }

    private setupTransactionParticles(): void {
        // Get the pfx_cash_register prefab from the collection (different from pfx_money used elsewhere)
        const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
        const cashRegisterPrefab = prefabCollection.getPrefabByName("pfx_cash_register")

        if (!cashRegisterPrefab) {
            console.warn("pfx_cash_register prefab not found, transaction particles disabled")
            return
        }
        
        // Get VFX position from prefab (coin_vfx_position node)
        const vfxPositionNode = this.stationDisplay.getDescendantByPath("/coin_vfx_position")

        // Instantiate the prefab
        const instance = PrefabLoader.instantiatePrefab(cashRegisterPrefab, this.stationComponentsObject)
        this.transactionParticleObject = instance.gameObject
        
        // Use position from prefab if available, otherwise use default offset
        if (vfxPositionNode) {
            this.transactionParticleObject.position.copy(vfxPositionNode.gameObject.position)
        }
        
        // Get the Particle component from the instantiated prefab
        // Note: Use ParticleSystemPrefabComponent since getComponent uses exact class matching
        this.transactionParticleComponent = this.transactionParticleObject.getComponent(ParticleSystemPrefabComponent) ?? null
    }

    private setupAudio(): void {
        this.audioComponent = new Audio2D(this.config.audioClips)
        this.gameObject.addComponent(this.audioComponent)
    }

    private setupMoneyPile(): void {
        this.moneyPileObject = new GameObject("MoneyPile")
        this.moneyPileObject.position.copy(this.config.moneyPilePosition)
        this.stationComponentsObject.add(this.moneyPileObject)

        this.moneyPile = new MoneyPile()
        this.moneyPileObject.addComponent(this.moneyPile)
    }

    private setupInteractionZones(): void {
        // Setup item dropoff zone
        this.itemDropoff = new ItemDropoffZone({
            zoneSize: this.config.dropoffZoneSize,
            zonePosition: this.config.dropoffZonePosition,
            itemType: this.config.itemType,
            stackPositions: this.config.stackPositions,
            audioClipName: this.config.dropoffAudioClip,
            onItemCollected: () => {
                const tutorialSystem = BurgerShopDirectory.getTutorialSystem()
                if (tutorialSystem) {
                    tutorialSystem.getTracker().recordBurgerDelivery()
                }
            },
        })
        this.stationComponentsObject.addComponent(this.itemDropoff)

        // Create checkout zone
        this.checkoutZoneObject = new GameObject("CheckoutProcessingZone")
        this.checkoutZoneObject.position.copy(this.config.checkoutZonePosition)
        this.stationComponentsObject.add(this.checkoutZoneObject)

        this.checkoutZone = new InteractionZone(
            (other: GameObject) => this.onEnterCheckout(other),
            (other: GameObject) => this.onExitCheckout(other),
            {
                width: this.config.checkoutZoneSize.width,
                depth: this.config.checkoutZoneSize.depth,
                active: true,
                show: false,
            },
        )
        this.checkoutZoneObject.addComponent(this.checkoutZone)

        // Add the interaction area display
        this.interactionAreaDisplay = new InteractionAreaDisplay()
        this.checkoutZoneObject.addComponent(this.interactionAreaDisplay)
    }

    private setupCustomerLine(): void {
        const customerLineObject = new GameObject("CustomerLine")
        customerLineObject.position.copy(this.config.customerLinePosition)
        this.stationComponentsObject.add(customerLineObject)

        this.customerLine = new LineOfCustomers({
            spline: this.config.lineSpline,
            spacing: this.config.lineSpacing,
        })

        customerLineObject.addComponent(this.customerLine)
    }

    private onEnterCheckout(gameObject: GameObject): void {
        const canCheckout = gameObject.getComponent(CanCheckout)

        if (canCheckout) {
            this.entitiesInCheckoutZone.add(gameObject)

            if (this.interactionAreaDisplay && this.entitiesInCheckoutZone.size === 1) {
                this.interactionAreaDisplay.setActive()
            }

            const player = gameObject.getComponent(PlayerComponent)
            if (player !== null) {
                this.checkoutTimer.duration = PLAYER_CHECKOUT_SPEED
                this.checkoutTimer.trigger()
            }
        }
    }

    private onExitCheckout(gameObject: GameObject): void {
        this.entitiesInCheckoutZone.delete(gameObject)

        if (this.interactionAreaDisplay && this.entitiesInCheckoutZone.size === 0 && !this.cashier) {
            this.interactionAreaDisplay.setInactive()
        }

        const player = gameObject.getComponent(PlayerComponent)
        if (player !== null) {
            this.checkoutTimer.duration = this.cashierCheckoutTime
        }
    }

    public getCheckoutZoneGameObject(): GameObject {
      return this.checkoutZoneObject!
    }

    public getItemType(): string {
      return this.config.itemType
    }

    public update(deltaTime: number): void {
        this.checkoutTimer.tick(deltaTime);

        this.itemDropoff.update(deltaTime)
        this.tryCheckoutCustomers()
        this.updateOrderIndicator()
    }

    private tryCheckoutCustomers(): void {
        if (this.cashier) {
            this.cashier.setUsingRegister(false)
        }

        const customer = this.getOrderingCustomer()
        if (!customer) {
            this.checkoutTimer.reset()
            return
        }

        const hasItems = this.itemDropoff.hasItemOfType(this.config.itemType)
        if (!hasItems) {
          this.checkoutTimer.reset()
          return
        }

        if (!this.IsCashierPresent()) {
          this.checkoutTimer.reset()
          return
        }

        const needsItems = customer.getItemsNeededCount() > 0
        if (!needsItems) {
            return
        }

        if (this.checkoutTimer.isRunning()) {
            if (this.cashier) {
                this.cashier.setUsingRegister(true)
            }
          return
        }

        this.giveCustomerItemAndGetMoney(customer)
    }

    private IsCashierPresent(): boolean {
        return this.cashier !== null || this.entitiesInCheckoutZone.size > 0
    }

    private getOrderingCustomer(): Customer | null {
        if (!this.customerLine.hasCustomerReachedOrderingPosition()) {
            return null
        }
        return this.customerLine.getFrontCustomer()?.getComponent(Customer) ?? null
    }

    private giveCustomerItemAndGetMoney(customer: Customer): void {
        const item = this.itemDropoff.removeItem(this.config.itemType)
        if (!item){
          console.error(`Expected at least one ${this.config.itemType} in checkout inventory, but none found.`)
          return
        }

        // Add money to money pile
        const itemPrice = CostManager.getCost(this.config.itemPriceCostKey)
        this.moneyPile.addMoney(itemPrice)

        // Give item to the customer
        customer.giveItem(item)

        // Play cash register sound for the sale
        this.audioComponent?.play("cash register")

        // Create money particle effect for the transaction
        this.transactionParticleComponent?.trigger(10)
        
        // Reset timer (duration was already set before calling this function)
        this.checkoutTimer.reset()
    }

    public getInventoryCount(): number {
        return this.itemDropoff.getItemCount()
    }

    public getDeliveryPosition(): THREE.Vector3 {
        return this.itemDropoff.getInteractionZoneObject().getWorldPosition(new THREE.Vector3())
    }

    public getItemDropoff(): ItemDropoffZone {
        return this.itemDropoff
    }

    // IUnlockable implementation
    public getUnlockableId(): string {
        return this.getGameObject().name
    }

    public getDisplayName(): string {
        return this.config.displayName
    }

    public getCost(): number {
        return CostManager.getCost(this.config.costKey)
    }

    public unlock(): void {
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.setEnabled(true)
        }
    }

    public acquire(fromStorage: boolean = false): void {
        this.stationComponentsObject.setEnabled(true)

        if (!fromStorage) {
            AnimationUtils.animateIn(this.stationComponentsObject)
        }

        this.setupNavigationObstacles()

        BurgerShopDirectory.registerCheckoutStation(this as any)

        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
            this.purchaseAreaObject = null
        }
    }

    public getCustomersInLineCount(): number {
        return this.customerLine.getLineLength()
    }

    private setupPurchaseArea(): void {
        this.purchaseAreaObject = new GameObject("CheckoutStationPurchaseArea")
        this.purchaseAreaObject.position.copy(this.gameObject.position)

        this.purchaseArea = new PurchaseArea(
            CostManager.getCost(this.config.costKey),
            this.config.purchaseAreaSize,
            "Checkout",
            () => UnlockManager.acquire(this),
        )

        this.purchaseAreaObject.addComponent(this.purchaseArea)
        this.gameObject.parent?.add(this.purchaseAreaObject)
    }

    private setupNavigationObstacles(): void {
        DynamicNavSystem.addBoxObstacleFromBounds(
            this.gameObject,
            new THREE.Vector3(3, 1.5, 1.5)
        )
        this.hasNavigationObstacle = true
    }

    public getDropoffPosition(): THREE.Vector3 {
        const worldPos = new THREE.Vector3()
        this.itemDropoff.getInteractionZoneObject().getWorldPosition(worldPos)
        return worldPos
    }

    public getWorkPosition(): THREE.Vector3 {
        const worldPos = new THREE.Vector3()
        this.gameObject.getWorldPosition(worldPos)
        worldPos.add(new THREE.Vector3(2, 0, 0.5))
        return worldPos
    }

    public getInteractionZoneObject(): GameObject | null {
        return this.itemDropoff.getInteractionZoneObject()
    }

    public getCustomerLine(): LineOfCustomers {
        return this.customerLine
    }

    protected onCleanup(): void {
        if (this.hasNavigationObstacle) {
            DynamicNavSystem.removeObstacleByGameObject(this.checkoutObject)
            this.hasNavigationObstacle = false
        }

        if (this.transactionParticleObject) {
            this.transactionParticleObject.dispose()
        }

        if (this.stationComponentsObject) {
            this.stationComponentsObject.dispose()
        }
        if (this.purchaseAreaObject) {
            this.purchaseAreaObject.dispose()
        }

        this.destroyOrderIndicator()
    }

    public setCashier(cashier: Cashier | null): void {
        this.cashier = cashier
        
        if (cashier && this.interactionAreaDisplay && this.entitiesInCheckoutZone.size === 0) {
            this.interactionAreaDisplay.setActive()
        } else if (!cashier && this.interactionAreaDisplay && this.entitiesInCheckoutZone.size === 0) {
            this.interactionAreaDisplay.setInactive()
        }
    }

    public onCashierSpeedChanged(newSpeed: number): void {
        this.cashierCheckoutTime = newSpeed
        // Update timer duration if cashier is currently checking out
        if (this.cashier && this.entitiesInCheckoutZone.size === 0) {
            this.checkoutTimer.duration = newSpeed
        }
    }

    // ICanHaveCashier implementation
    public getPurchaseAreaPosition(): THREE.Vector3 {
        const localPos = new THREE.Vector3(3.7, 0, 0.5)
        return this.gameObject.localToWorld(localPos)
    }

    public getCashierPosition(): THREE.Vector3 {
        const localPos = this.config.checkoutZonePosition.clone()
        return this.gameObject.localToWorld(localPos)
    }

    public getCashierRotation(): THREE.Euler {
        const worldQuat = new THREE.Quaternion()
        this.gameObject.getWorldQuaternion(worldQuat)
        
        const additionalRot = new THREE.Quaternion().setFromEuler(new THREE.Euler(0, Math.PI, 0))
        worldQuat.multiply(additionalRot)
        
        const result = new THREE.Euler()
        result.setFromQuaternion(worldQuat)
        return result
    }
}

