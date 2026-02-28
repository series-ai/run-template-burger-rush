import { Component } from "@series-inc/rundot-3d-engine"
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"
import { BurgerShopUI } from "@game/ui/BurgerShopUI"

export class PickupConfirmPopupUI {
    private titleText!: string
    private bodyText!: string
    private onConfirm!: () => void
    private onCancel!: () => void
    private popupElement: HTMLElement | null = null
    private overlayElement: HTMLElement | null = null
    private visible: boolean = false

    constructor(titleText: string, bodyText: string, onConfirm: () => void, onCancel: () => void) {
        this.titleText = titleText
        this.bodyText = bodyText
        this.onConfirm = onConfirm
        this.onCancel = onCancel

        this.ensureMoneyIconStyles()
    }

    protected onAwake(): void {
        this.render()
    }

    public show(): void {
        this.render()
        this.visible = true
    }

    public hide(): void {
        this.visible = false
        this.destroy()
    }

    public isVisible(): boolean {
        return this.visible
    }

    private render(): void {
        // Create overlay and container using BurgerShopUI utilities
        this.overlayElement = BurgerShopUI.createOverlay()
        this.popupElement = BurgerShopUI.createContainer()
        
        // Apply sizing
        this.popupElement.style.width = '400px'
        this.popupElement.style.padding = '24px'
        
        // Set initial state for animation (combine centering with scale)
        this.popupElement.style.transform = 'translate(-50%, -50%) scale(0.8)'
        this.popupElement.style.opacity = '0'
        this.popupElement.style.transition = 'all 0.2s ease-out'
        
        // Create title using BurgerShopUI
        const title = BurgerShopUI.createTitle(this.titleText, true)
        title.style.textTransform = 'uppercase'
        title.style.marginBottom = '16px'
        
        // Create body text using BurgerShopUI subtitle
        const body = BurgerShopUI.createSubtitle(this.bodyText)
        body.style.whiteSpace = 'pre-line'
        body.style.marginBottom = '24px'
        
        // Create buttons container
        const buttonsContainer = document.createElement('div')
        buttonsContainer.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: center;
        `
        
        // Create buttons using BurgerShopUI utilities
        const cancelBtn = BurgerShopUI.createSecondaryButton('Cancel')
        cancelBtn.style.flex = '1'
        cancelBtn.style.padding = '12px 24px'
        cancelBtn.style.fontSize = '16px'
        cancelBtn.addEventListener('click', () => this.cancelPressed())
        
        const confirmBtn = BurgerShopUI.createPrimaryButton('<span class="burger-shop-upgrade-card-btn-icon">📺</span> FREE')
        confirmBtn.style.flex = '1'
        confirmBtn.style.padding = '12px 24px'
        confirmBtn.style.fontSize = '16px'
        confirmBtn.addEventListener('click', () => this.confirmPressed())
        
        // Assemble the popup
        buttonsContainer.appendChild(cancelBtn)
        buttonsContainer.appendChild(confirmBtn)
        
        this.popupElement.appendChild(title)
        this.popupElement.appendChild(body)
        this.popupElement.appendChild(buttonsContainer)
        
        this.overlayElement.appendChild(this.popupElement)
        document.body.appendChild(this.overlayElement)
        
        // Trigger animations with bounce effect (maintain centering throughout)
        requestAnimationFrame(() => {
            if (this.popupElement) {
                this.popupElement.style.transform = 'translate(-50%, -50%) scale(1.2)'
                this.popupElement.style.opacity = '1'
                
                setTimeout(() => {
                    if (this.popupElement) {
                        this.popupElement.style.transform = 'translate(-50%, -50%) scale(1)'
                    }
                }, 200)
            }
        })
    }

    protected async confirmPressed(): Promise<void> {
        try {
            const adSuccess = await RundotGameAPI.ads.showRewardedAdAsync()
            this.disablePanelButtons()
            if (!adSuccess) {
                this.onCancel()
                return
            }

            this.onConfirm()
        } catch (error) {
            console.error('[PickupConfirmPopupUI] Error showing ad:', error)
            this.onCancel()
        }
        this.destroy()
    }

    protected cancelPressed(): void {
        this.onCancel()
        this.destroy()
    }

    private disablePanelButtons(): void {
        if (!this.popupElement) return

        const buttons = this.popupElement.querySelectorAll('button[data-upgrade-id]') as NodeListOf<HTMLButtonElement>
        buttons.forEach((button) => {
            button.disabled = true
            button.style.opacity = '0.6'
        })
    }

    private ensureMoneyIconStyles(): void {
        if (!document.querySelector("#popup-money-icon-style")) {
            const iconStyle = document.createElement("style")
            iconStyle.id = "popup-money-icon-style"
            iconStyle.textContent = `
            .popup-money-icon {
                width: 1em;
                height: 1em;
                background-image: url('assets/cozy_game_general/money_icon.png');
                background-size: contain;
                background-repeat: no-repeat;
                background-position: center;
                display: inline-block;
                vertical-align: middle;
                margin: 0 2px;
                filter: brightness(1.1);
            }
        `
            document.head.appendChild(iconStyle)
        }
    }

    private destroy(): void {
        // Animate out (maintain centering with scale)
        if (this.popupElement) {
            this.popupElement.style.transform = 'translate(-50%, -50%) scale(0.8)'
            this.popupElement.style.opacity = '0'
        }
        
        // Remove after animation completes
        setTimeout(() => {
            if (this.overlayElement && this.overlayElement.parentNode) {
                this.overlayElement.parentNode.removeChild(this.overlayElement)
            }
            this.overlayElement = null
            this.popupElement = null
        }, 200)
    }
}