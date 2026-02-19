import { MoneySystem } from "@game/money"
import "./burgershop-ui.css"
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"

export interface UpgradeData {
  id: string
  label: string
  getCurrentLevel: () => number
  canUpgrade: () => boolean
  getCost: () => number // cost for next level
  getLevel: () => string // level text (e.g., "Level 2")
  getDescription: () => string // description text (e.g., "Max stack of 4")
  getBenefit?: () => string // benefit text for next level (e.g., "+14% move speed")
  onUpgrade: (newLevel: number) => Promise<void> | void // called after money is spent or ad is watched
  canWatchAd?: () => boolean // if provided, determines if ad button should be enabled (defaults to same as canUpgrade)
}

export interface UpgradePanelConfig {
  title: string
  upgrades: UpgradeData[]
}

export class GenericUpgradePanel {
  private panelElement: HTMLElement | null = null
  private config: UpgradePanelConfig
  private isShowingAd: boolean = false

  private constructor(config: UpgradePanelConfig) {
    this.config = config
  }

  public static open(config: UpgradePanelConfig): GenericUpgradePanel {
    const panel = new GenericUpgradePanel(config)
    panel.render()
    return panel
  }

  public close(): void {
    if (this.panelElement) {
      // Animate out
      const content = this.panelElement.querySelector('.burger-shop-bottom-panel-content') as HTMLElement
      if (content) {
        content.style.animation = 'burger-shop-slide-down 0.2s ease-in forwards'
        setTimeout(() => {
          if (this.panelElement && this.panelElement.parentNode) {
            this.panelElement.parentNode.removeChild(this.panelElement)
          }
          this.panelElement = null
        }, 200)
      } else {
        if (this.panelElement.parentNode) {
          this.panelElement.parentNode.removeChild(this.panelElement)
        }
        this.panelElement = null
      }
    }
    delete (window as any).closeUpgradeUI
  }

  private render(): void {
    // Create the bottom panel container
    this.panelElement = document.createElement('div')
    this.panelElement.className = 'burger-shop-bottom-panel'

    // Create panel content
    const content = document.createElement('div')
    content.className = 'burger-shop-bottom-panel-content'

    // Create header with title
    const header = document.createElement('div')
    header.className = 'burger-shop-bottom-panel-header'

    const title = document.createElement('h3')
    title.className = 'burger-shop-bottom-panel-title'
    title.textContent = this.config.title

    header.appendChild(title)

    // Create upgrades container (horizontal scrollable)
    const upgradesContainer = document.createElement('div')
    upgradesContainer.className = 'burger-shop-bottom-panel-upgrades'

    // Build upgrade cards
    this.buildUpgradeCards(upgradesContainer)

    // Assemble panel
    content.appendChild(header)
    content.appendChild(upgradesContainer)
    this.panelElement.appendChild(content)

    // Add to page
    document.body.appendChild(this.panelElement)

    // Set up global close function for compatibility
    ;(window as any).closeUpgradeUI = () => this.close()
  }

  private buildUpgradeCards(container: HTMLElement): void {
    const money = MoneySystem.getMoney()
    container.innerHTML = ''

    this.config.upgrades.forEach((upgrade) => {
      const can = upgrade.canUpgrade()
      const cost = upgrade.getCost()
      const canAd = upgrade.canWatchAd ? upgrade.canWatchAd() : can
      const isMaxed = !can
      const cantAfford = money < cost

      const card = document.createElement('div')
      card.className = 'burger-shop-upgrade-card'

      // Header with label, level, and description
      const cardHeader = document.createElement('div')
      cardHeader.className = 'burger-shop-upgrade-card-header'

      const label = document.createElement('div')
      label.className = 'burger-shop-upgrade-card-label'
      label.textContent = upgrade.label

      const level = document.createElement('div')
      level.className = 'burger-shop-upgrade-card-level'
      level.textContent = upgrade.getLevel()

      const desc = document.createElement('div')
      desc.className = 'burger-shop-upgrade-card-desc'
      desc.textContent = upgrade.getDescription()

      cardHeader.appendChild(label)
      cardHeader.appendChild(level)
      cardHeader.appendChild(desc)

      // Level Up label with benefit (only if not maxed)
      if (!isMaxed) {
        const levelUpContainer = document.createElement('div')
        levelUpContainer.className = 'burger-shop-upgrade-card-levelup-container'
        
        const levelUpLabel = document.createElement('div')
        levelUpLabel.className = 'burger-shop-upgrade-card-levelup'
        levelUpLabel.textContent = 'Next Level'
        levelUpContainer.appendChild(levelUpLabel)
        
        // Add benefit text if provided
        if (upgrade.getBenefit) {
          const benefitLabel = document.createElement('div')
          benefitLabel.className = 'burger-shop-upgrade-card-benefit'
          benefitLabel.textContent = upgrade.getBenefit()
          levelUpContainer.appendChild(benefitLabel)
        }
        
        card.appendChild(cardHeader)
        card.appendChild(levelUpContainer)
      } else {
        card.appendChild(cardHeader)
      }

      // Buttons container
      const buttonsContainer = document.createElement('div')
      buttonsContainer.className = 'burger-shop-upgrade-card-buttons'

      if (isMaxed) {
        // MAX LEVEL text (not a button)
        const maxText = document.createElement('div')
        maxText.className = 'burger-shop-upgrade-card-maxed'
        maxText.innerHTML = '✓ MAX LEVEL'
        buttonsContainer.appendChild(maxText)
      } else {
        // Ad button
        const adBtn = document.createElement('button')
        adBtn.className = 'burger-shop-upgrade-card-btn burger-shop-upgrade-card-btn--ad'
        adBtn.innerHTML = '<span class="burger-shop-upgrade-card-btn-icon">📺</span> Watch'
        adBtn.disabled = !canAd
        adBtn.setAttribute('data-upgrade-id', upgrade.id)
        adBtn.setAttribute('data-upgrade-type', 'ad')
        adBtn.addEventListener('click', () => this.handleUpgradeClick(upgrade, 'ad'))
        buttonsContainer.appendChild(adBtn)

        // Money button (use green style for free, orange for paid)
        const moneyBtn = document.createElement('button')
        
        if (cost === 0) {
          moneyBtn.className = 'burger-shop-upgrade-card-btn burger-shop-upgrade-card-btn--free'
          moneyBtn.innerHTML = 'FREE'
        } else {
          moneyBtn.className = 'burger-shop-upgrade-card-btn burger-shop-upgrade-card-btn--money'
          moneyBtn.innerHTML = `<span class="burger-shop-upgrade-card-money-icon"></span> ${cost}`
        }
        
        moneyBtn.disabled = cantAfford
        moneyBtn.setAttribute('data-upgrade-id', upgrade.id)
        moneyBtn.setAttribute('data-upgrade-type', 'money')
        moneyBtn.addEventListener('click', () => this.handleUpgradeClick(upgrade, 'money'))
        buttonsContainer.appendChild(moneyBtn)
      }

      card.appendChild(buttonsContainer)
      container.appendChild(card)
    })
  }

  private async handleUpgradeClick(upgrade: UpgradeData, type: 'money' | 'ad'): Promise<void> {
    let upgradeSuccessful = false

    if (type === 'money') {
      const cost = upgrade.getCost()
      if (!upgrade.canUpgrade()) return
      if (!MoneySystem.spendMoney(cost)) return
      upgradeSuccessful = true
    } else if (type === 'ad') {
      const canWatchAd = upgrade.canWatchAd ? upgrade.canWatchAd() : upgrade.canUpgrade()
      if (!canWatchAd) return

      if (this.isShowingAd) {
        return
      }

      try {
        this.isShowingAd = true
        this.disablePanelButtons()

        const adSuccess = await RundotGameAPI.ads.showRewardedAdAsync()

        if (adSuccess) {
          upgradeSuccessful = true
        }
      } catch (error) {
        console.error('[GenericUpgradePanel] Error showing ad:', error)
      } finally {
        this.isShowingAd = false
        this.updateContent()

        if (!upgradeSuccessful) {
          return
        }
      }
    }

    if (upgradeSuccessful) {
      const newLevel = upgrade.getCurrentLevel() + 1
      await upgrade.onUpgrade(newLevel)
      this.updateContent()
      this.showPurchaseSuccess()
    }
  }

  private updateContent(): void {
    if (!this.panelElement) return

    const upgradesContainer = this.panelElement.querySelector('.burger-shop-bottom-panel-upgrades')
    if (upgradesContainer) {
      this.buildUpgradeCards(upgradesContainer as HTMLElement)
    }
  }

  private showPurchaseSuccess(): void {
    if (!this.panelElement) return
    
    const content = this.panelElement.querySelector('.burger-shop-bottom-panel-content') as HTMLElement
    if (!content) return

    // Remove any existing success overlay
    const existing = document.querySelector('.upgrade-success-overlay')
    if (existing) {
      existing.remove()
    }

    // Create floating success overlay above the panel
    const successOverlay = document.createElement('div')
    successOverlay.className = 'upgrade-success-overlay'
    successOverlay.style.cssText = `
      position: fixed;
      bottom: ${content.offsetHeight + 20}px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(255, 255, 255, 0.95);
      backdrop-filter: blur(5px);
      padding: 16px 24px;
      border-radius: 20px;
      display: flex;
      align-items: center;
      gap: 12px;
      box-shadow: 0 5px 0 rgba(46, 204, 113, 0.3), 0 10px 30px rgba(0, 0, 0, 0.2);
      z-index: 10001;
      opacity: 0;
      transition: opacity 0.3s ease-out, transform 0.3s ease-out;
    `

    // Animated Checkmark Circle
    const iconContainer = document.createElement('div')
    iconContainer.style.cssText = `
      width: 50px;
      height: 50px;
      min-width: 50px;
      min-height: 50px;
      flex-shrink: 0;
      background: #2ecc71;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      box-shadow: 0 4px 0 #27ae60;
      transform: scale(0) rotate(-45deg);
      transition: transform 0.4s cubic-bezier(0.34, 1.56, 0.64, 1);
    `

    // SVG Checkmark
    iconContainer.innerHTML = `
      <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="4" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="20 6 9 17 4 12"></polyline>
      </svg>
    `

    // Success Text
    const text = document.createElement('div')
    text.textContent = 'Upgrade Complete!'
    text.style.cssText = `
      font-family: var(--game-font);
      font-size: 20px;
      font-weight: 700;
      color: #2c3e50;
      transform: translateX(-10px);
      opacity: 0;
      transition: all 0.3s ease-out 0.15s;
    `

    successOverlay.appendChild(iconContainer)
    successOverlay.appendChild(text)
    document.body.appendChild(successOverlay)

    // Trigger animations
    requestAnimationFrame(() => {
      successOverlay.style.opacity = '1'
      iconContainer.style.transform = 'scale(1) rotate(0deg)'
      text.style.transform = 'translateX(0)'
      text.style.opacity = '1'
    })

    // Remove after animation
    setTimeout(() => {
      successOverlay.style.opacity = '0'
      successOverlay.style.transform = 'translateX(-50%) translateY(10px)'
      
      setTimeout(() => {
        if (successOverlay.parentNode) {
          successOverlay.parentNode.removeChild(successOverlay)
        }
      }, 300)
    }, 1500)
  }

  private disablePanelButtons(): void {
    if (!this.panelElement) return
    
    const buttons = this.panelElement.querySelectorAll('button[data-upgrade-id]') as NodeListOf<HTMLButtonElement>
    buttons.forEach((button) => {
      button.disabled = true
      button.style.opacity = '0.6'
    })
  }
}
