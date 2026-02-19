import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"
import { UnlockManager, MoneySystem, UnlockableComponent } from "@game/money"
import { BurgerShopDirectory } from "@game/BurgerShopDirectory"
import { PlayerComponent } from "@game/PlayerComponent"
import { BurgerShopUI } from "../ui/BurgerShopUI"
import { ShopSystem } from "../shop/ShopSystem"
import { ShopItem } from "../shop/ShopItem"

export class TimedAdSystem extends Component {
    private static instance: TimedAdSystem | null = null
    
    // Control flags
    private enabled: boolean = false
    private adsDisabledPermanently: boolean = false

    // Time tracking
    private timeSinceLastAd: number = 0
    private nextAdInterval: number = 0
    private isShowingAd: boolean = false
    private progressedFarEnoughForAds: boolean = false // Don't start until trashcan is unlocked
    
    // Popup state
    private isShowingPopup: boolean = false
    private popupElement: HTMLElement | null = null

    // Player reference for movement control
    private playerComponent: PlayerComponent | undefined = undefined

    // Shop system reference
    private shopSystem: ShopSystem

    // Shop promotion tracking
    private hasShownFirstAd: boolean = false
    private lastShopPromotionTime: number = 0
    private readonly SHOP_PROMOTION_COOLDOWN = 15 * 60 * 1000 // 15 minutes in milliseconds
    
    // First ad trigger on building unlock
    private triggerUnlockable: UnlockableComponent | undefined = undefined
    private firstAdTriggered: boolean = false
    private readonly FIRST_AD_DELAY = 15 // 15 seconds after unlock

    // Ad interval configuration (in seconds)
    private readonly MIN_AD_INTERVAL = 150 // 2.5 minutes
    private readonly MAX_AD_INTERVAL = 300 // 5 minutes
    // private readonly MIN_AD_INTERVAL = 90 // 1.5 minutes
    // private readonly MAX_AD_INTERVAL = 150 // 2.5 minutes
    // private readonly MIN_AD_INTERVAL = 5
    // private readonly MAX_AD_INTERVAL = 8

    // Storage keys
    private static readonly STORAGE_KEY_ADS_DISABLED = "burger_shop_ads_disabled"

    constructor(playerGameObject: GameObject, shopSystem: ShopSystem, triggerUnlockable?: UnlockableComponent) {
        super()
        this.generateNextAdInterval()

        this.playerComponent = playerGameObject.getComponent(PlayerComponent)
        this.shopSystem = shopSystem
        this.triggerUnlockable = triggerUnlockable

        if (!this.playerComponent) {
            console.warn('[TimedAdSystem] PlayerComponent not found on player GameObject')
        }

        // Set static instance
        TimedAdSystem.instance = this

        // Setup trigger unlock logic if provided
        if (this.triggerUnlockable) {
            const isAlreadyAcquired = UnlockManager.isAcquired(this.triggerUnlockable)
            if (!isAlreadyAcquired) {
                UnlockManager.addAcquireListener(this.handleAcquire.bind(this))
            }
        }

        // Initialize immediately with shop system
        this.initialize(shopSystem)
    }

    /**
     * Get the TimedAdSystem instance for external access
     */
    public static getInstance(): TimedAdSystem | null {
        return TimedAdSystem.instance
    }

    /**
     * Handle acquisition events from UnlockManager
     * Triggers the first ad when the trigger unlockable is acquired
     */
    private handleAcquire(acquiredItem: UnlockableComponent, newlyUnlocked: UnlockableComponent[]): void {
        if (acquiredItem === this.triggerUnlockable && !this.firstAdTriggered && !this.adsDisabledPermanently) {
            this.firstAdTriggered = true
            this.timeSinceLastAd = 0
            this.nextAdInterval = this.FIRST_AD_DELAY
            this.progressedFarEnoughForAds = true
        }
    }

    /**
     * Initialize the timed ad system and setup shop integration
     */
    private async initialize(shopSystem: ShopSystem): Promise<void> {
        // Check if ads were previously disabled
        await this.loadAdState()

        // Add "Remove All Ads" purchase to shop (only if not already purchased)
        this.setupRemoveAdsShopItem(shopSystem)

        console.log('[TimedAdSystem] Initialized with ads enabled')
    }

    /**
     * Load ad disabled state from persistent storage
     */
    private async loadAdState(): Promise<void> {
        try {
            const savedState = await RundotGameAPI.appStorage.getItem(TimedAdSystem.STORAGE_KEY_ADS_DISABLED)
            if (savedState) {
                this.adsDisabledPermanently = JSON.parse(savedState)
                console.log(`[TimedAdSystem] Loaded ad state: ${this.adsDisabledPermanently ? 'disabled' : 'enabled'}`)
            }
        } catch (error) {
            console.warn('[TimedAdSystem] Failed to load ad state:', error)
        }
    }

    /**
     * Save ad disabled state to persistent storage
     */
    private async saveAdState(): Promise<void> {
        try {
            await RundotGameAPI.appStorage.setItem(
                TimedAdSystem.STORAGE_KEY_ADS_DISABLED, 
                JSON.stringify(this.adsDisabledPermanently)
            )
            console.log(`[TimedAdSystem] Saved ad state: ${this.adsDisabledPermanently ? 'disabled' : 'enabled'}`)
        } catch (error) {
            console.error('[TimedAdSystem] Failed to save ad state:', error)
        }
    }

    /**
     * Setup the "Remove All Ads" shop item
     */
    private setupRemoveAdsShopItem(shopSystem: ShopSystem): void {
        const removeAdsItem: ShopItem = {
            id: 'remove_ads_permanent',
            title: '🚫 Remove All Ads',
            description: 'Remove automatic ads permanently! No interruptions while building your empire.',
            price: 100,
            currency: '💎',
            category: 'special',
            purchased: false,
            onPurchaseSuccess: async () => {
                await this.disableAdsPermanently()
            }
        }

        shopSystem.addItem(removeAdsItem)
        console.log('[TimedAdSystem] Added "Remove All Ads" purchase to shop')
    }

    private generateNextAdInterval(): void {
        const range = this.MAX_AD_INTERVAL - this.MIN_AD_INTERVAL
        this.nextAdInterval = this.MIN_AD_INTERVAL + (Math.random() * range)
    }

    /**
     * Disable ads permanently after successful purchase
     */
    private async disableAdsPermanently(): Promise<void> {
        console.log('[TimedAdSystem] Disabling ads permanently after successful purchase')
        
        // Disable ads permanently
        this.adsDisabledPermanently = true
        
        // Save state
        await this.saveAdState()
        
        console.log('[TimedAdSystem] ✅ Ads disabled permanently!')
    }

    /**
     * Component update - tracks time and shows ads at intervals
     */
    public update(deltaTime: number): void {
        if (!this.enabled || this.adsDisabledPermanently) {
            return
        }

        if (this.isShowingAd || this.isShowingPopup) {
            return
        }

        if (!this.progressedFarEnoughForAds) {
            this.checkIfProgressedFarEnoughForAds()
            if (!this.progressedFarEnoughForAds) {
                return
            }
        }

        this.timeSinceLastAd += deltaTime
        if (this.timeSinceLastAd >= this.nextAdInterval) {
            this.timeSinceLastAd = 0
            this.generateNextAdInterval()
            this.showAdPopup()
        }
    }

    private async showAdPopup(): Promise<void> {
        this.isShowingPopup = true
        this.playerComponent?.setMovementEnabled(false)
        this.showPopup()

        // If this was the first triggered ad, reset to normal intervals
        if (this.firstAdTriggered) {
            this.generateNextAdInterval()
        }
    }

    private async showActualAd(): Promise<void> {
        this.isShowingPopup = false
        this.isShowingAd = true
        this.hidePopup()

        try {         
            console.log('[TimedAdSystem] Showing rewarded ad...')
            const rewardedSuccess = await RundotGameAPI.ads.showInterstitialAd()
            if (rewardedSuccess) {
                // Give player $30 reward for watching ad (with animation)
                MoneySystem.addMoneyAnimated(30)
                console.log('[TimedAdSystem] Player earned $30 for watching ad!')
                
                // Check if we should promote the shop after this ad
                this.checkShopPromotion()
            } else {
                console.warn('[TimedAdSystem] Rewarded ad was not shown successfully')
            }
        } catch (error) {
            console.error('[TimedAdSystem] Error showing ad:', error)
        }
        
        this.playerComponent?.setMovementEnabled(true)
        this.isShowingAd = false
    }

    /**
     * Check if we should show shop promotion after watching an ad
     */
    private checkShopPromotion(): void {
        const now = Date.now()
        
        // First ad in session - always show shop
        if (!this.hasShownFirstAd) {
            this.hasShownFirstAd = true
            this.lastShopPromotionTime = now
            this.promoteShop()
            return
        }
        
        // Subsequent ads - only show if 15 minutes have passed
        if (now - this.lastShopPromotionTime >= this.SHOP_PROMOTION_COOLDOWN) {
            this.lastShopPromotionTime = now
            this.promoteShop()
        }
    }

    /**
     * Show shop promotion after watching an ad
     */
    private promoteShop(): void {
        console.log('[TimedAdSystem] Promoting shop after ad view')
        
        try {
            this.shopSystem.openShop()
            console.log('[TimedAdSystem] Opened shop for promotion')
        } catch (error) {
            console.error('[TimedAdSystem] Failed to open shop for promotion:', error)
        }
    }

    /**
     * Show the "Take a break" popup with $30 reward button
     */
    private showPopup(): void {
        // Create overlay and container manually (no close button for timed ads - no overlay click close)
        const overlay = BurgerShopUI.createOverlay() // No onClick for timed ads
        const container = BurgerShopUI.createContainer()
        
        // Set custom width and extra padding for button
        container.style.width = '380px'
        container.style.padding = '24px 24px 40px 24px' // Extra bottom padding for button shadow
        
        // Create title (no close button)
        const title = BurgerShopUI.createTitle('Take a Break!', true)
        
        // Create subtitle text
        const subtitle = BurgerShopUI.createSubtitle('Watch a short ad and earn some extra cash!')
        subtitle.style.marginBottom = '24px' // Extra space before button
        
        // Create reward button with money styling
        const rewardButton = BurgerShopUI.createPrimaryButton('<span class="money-display-icon"></span>30')
        rewardButton.style.cssText += `
            font-size: 22px;
            padding: 16px 24px;
            margin: 0 auto;
            background: ${MoneySystem.MONEY_COLORS.GREEN_GRADIENT};
            box-shadow: 0 6px 0 ${MoneySystem.MONEY_COLORS.GREEN_SHADOW}, 0 8px 20px rgba(34, 197, 94, 0.4);
            display: flex;
            width: fit-content;
        `
        
        // Add button hover effects
        rewardButton.addEventListener('mouseenter', () => {
            rewardButton.style.transform = 'translateY(-2px)'
            rewardButton.style.boxShadow = `0 8px 0 ${MoneySystem.MONEY_COLORS.GREEN_SHADOW}, 0 10px 25px rgba(34, 197, 94, 0.5)`
        })
        
        rewardButton.addEventListener('mouseleave', () => {
            rewardButton.style.transform = 'translateY(0)'
            rewardButton.style.boxShadow = `0 6px 0 ${MoneySystem.MONEY_COLORS.GREEN_SHADOW}, 0 8px 20px rgba(34, 197, 94, 0.4)`
        })

        // Add click handler
        rewardButton.addEventListener('click', () => {
            this.showActualAd()
        })

        // Assemble the popup manually
        container.appendChild(title)
        container.appendChild(subtitle)
        container.appendChild(rewardButton)
        overlay.appendChild(container)

        // Store reference
        this.popupElement = overlay

        // Add to page
        document.body.appendChild(overlay)

        console.log('[TimedAdSystem] Showing ad reward popup')
    }

    /**
     * Hide the popup
     */
    private hidePopup(): void {
        if (this.popupElement && document.body.contains(this.popupElement)) {
            document.body.removeChild(this.popupElement)
            this.popupElement = null
        }
    }

    private checkIfProgressedFarEnoughForAds(): void {
        const activeTrashCans = BurgerShopDirectory.getActiveTables()
        if (activeTrashCans.length > 1) {
            this.progressedFarEnoughForAds = true
        }
    }

    /**
     * Get the current enabled state of the timed ad system
     */
    public isEnabled(): boolean {
        return this.enabled && !this.adsDisabledPermanently
    }

    /**
     * Check if ads are permanently disabled via purchase
     */
    public areAdsDisabled(): boolean {
        return this.adsDisabledPermanently
    }

    /**
     * Debug method to reset ad purchase state
     */
    public async debugResetAdPurchase(): Promise<void> {
        this.adsDisabledPermanently = false
        await this.saveAdState()
        
        // Re-add the shop item
        this.setupRemoveAdsShopItem(this.shopSystem)
        
        console.log('[TimedAdSystem] DEBUG: Reset ad purchase state')
    }

    /**
     * Component disposal - clean up popup if still showing
     */
    protected onDestroy(): void {
        if (this.isShowingPopup) {
            this.hidePopup()
            this.isShowingPopup = false
        }
        
        if (this.isShowingAd) {
            this.playerComponent?.setMovementEnabled(true)
            this.isShowingAd = false
        }

        // Remove acquire listener if it was registered
        if (this.triggerUnlockable) {
            UnlockManager.removeAcquireListener(this.handleAcquire.bind(this))
        }

        // Clear static instance
        if (TimedAdSystem.instance === this) {
            TimedAdSystem.instance = null
        }
    }
}
