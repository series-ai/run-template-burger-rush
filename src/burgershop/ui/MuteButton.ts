import { UISystem } from "@series-inc/rundot-3d-engine/systems"

export type MuteButtonClickCallback = () => void

/**
 * Mute/Unmute button for all audio
 * Toggles all audio on/off when clicked
 * Uses UISystem for proper inset handling and consistent styling
 */
export class MuteButton {
    private static instance: MuteButton | null = null
    private _uiElement: any = null
    private _isVisible: boolean = false
    private _isMuted: boolean = false
    private onClickCallback: MuteButtonClickCallback | null = null

    private constructor() {}

    public static getInstance(): MuteButton {
        if (!MuteButton.instance) {
            MuteButton.instance = new MuteButton()
        }
        return MuteButton.instance
    }

    /**
     * Initialize and show the mute button
     */
    public initialize(onClick?: MuteButtonClickCallback): void {
        this.onClickCallback = onClick || null
        this.createButton()
        this.show()
    }

    /**
     * Create the mute button element using UISystem
     */
    private createButton(): void {
        if (this._uiElement) {
            return
        }

        // Ensure UISystem is initialized
        UISystem.initialize()

        // Add mute button styles to document head (consistent with ShopButton pattern)
        this.addMuteButtonStyles()

        // Create button using UISystem.createHUD for proper inset handling
        // Position on right side, below music mute button
        this._uiElement = UISystem.createHUD(
            "mute-button",
            "",
            { x: window.innerWidth - 90, y: 260 }, // Right side, below music button
        )

        // Add mute button specific class
        this._uiElement.element.classList.add("ui-mute-button")

        // Style with consistent UISystem approach (like ShopButton and MoneyUI)
        // Use cssText = (not +=) to completely override UISystem defaults
        this._uiElement.element.style.cssText = `
          position: absolute !important;
          top: 260px !important;
          right: 20px !important;
          left: auto !important;
          width: 60px !important;
          height: 60px !important;
          background: linear-gradient(135deg, #f59e0b 0%, #d97706 100%) !important;
          color: white !important;
          border-radius: 50% !important;
          box-shadow: 0 4px 0 #b45309, 0 8px 15px rgba(245, 158, 11, 0.3) !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          z-index: 1001 !important;
          pointer-events: auto !important;
          transition: all 0.2s ease !important;
          user-select: none !important;
          opacity: 0.9 !important;
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
          outline: none !important;
          box-sizing: border-box !important;
          min-width: 60px !important;
          min-height: 60px !important;
          max-width: 60px !important;
          max-height: 60px !important;
        `

        // Add click handler
        this._uiElement.element.addEventListener("click", () => {
            this.handleClick()
        })

        // Set initial icon
        this.updateButtonIcon()
    }

    /**
     * Add mute button styles to document head (consistent with ShopButton pattern)
     */
    private addMuteButtonStyles(): void {
        if (!document.querySelector("#mute-button-icon-style")) {
            const iconStyle = document.createElement("style")
            iconStyle.id = "mute-button-icon-style"
            iconStyle.textContent = `
        .ui-mute-button:hover {
          opacity: 1 !important;
          transform: scale(1.05) !important;
        }

        .ui-mute-button:active {
          transform: scale(0.95) !important;
          box-shadow: 0 2px 0 #b45309, 0 4px 8px rgba(245, 158, 11, 0.2) !important;
        }

        .ui-mute-button.muted {
          background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%) !important;
          box-shadow: 0 4px 0 #374151, 0 8px 15px rgba(107, 114, 128, 0.3) !important;
          opacity: 0.7 !important;
        }

        @media (max-width: 768px) {
          .ui-mute-button {
            width: 50px !important;
            height: 50px !important;
            font-size: 24px !important;
          }
        }
      `
            document.head.appendChild(iconStyle)
        }
    }

    /**
     * Handle button click
     */
    private handleClick(): void {
        this.toggleMute()

        if (this.onClickCallback) {
            this.onClickCallback()
        }
    }

    /**
     * Toggle mute state
     */
    public toggleMute(): void {
        this._isMuted = !this._isMuted
        this.updateButtonIcon()
    }

    /**
     * Set mute state
     */
    public setMuted(muted: boolean): void {
        this._isMuted = muted
        this.updateButtonIcon()
    }

    /**
     * Get current mute state
     */
    public get isMuted(): boolean {
        return this._isMuted
    }

    /**
     * Get the icon for sound on state
     */
    private getSoundOnIcon(): string {
        return `<img src="assets/cozy_game_general/volume.svg" width="32" height="32" style="filter: brightness(0) invert(1);" alt="Sound on" />`
    }

    /**
     * Get the icon for sound off state
     */
    private getSoundOffIcon(): string {
        return `<img src="assets/cozy_game_general/volume-off.svg" width="32" height="32" style="filter: brightness(0) invert(1);" alt="Sound off" />`
    }

    /**
     * Update the button icon based on mute state
     */
    private updateButtonIcon(): void {
        if (this._uiElement && this._uiElement.element) {
            this._uiElement.element.innerHTML = this._isMuted ? this.getSoundOffIcon() : this.getSoundOnIcon()
            if (this._isMuted) {
                this._uiElement.element.classList.add("muted")
            } else {
                this._uiElement.element.classList.remove("muted")
            }
        }
    }

    /**
     * Show the mute button
     */
    public show(): void {
        if (this._uiElement && !this._isVisible) {
            this._uiElement.element.style.display = "flex"
            this._isVisible = true
        }
    }

    /**
     * Hide the mute button
     */
    public hide(): void {
        if (this._uiElement && this._isVisible) {
            this._uiElement.element.style.display = "none"
            this._isVisible = false
        }
    }

    /**
     * Clean up the button
     */
    public destroy(): void {
        if (this._uiElement) {
            this._uiElement.remove()
            this._uiElement = null
        }
        this._isVisible = false
    }
}

/**
 * Mute/Unmute button for music only
 * Toggles music on/off when clicked
 * Uses UISystem for proper inset handling and consistent styling
 */
export class MuteMusicButton {
    private static instance: MuteMusicButton | null = null
    private _uiElement: any = null
    private _isVisible: boolean = false
    private _isMuted: boolean = false
    private onClickCallback: MuteButtonClickCallback | null = null

    private constructor() {}

    public static getInstance(): MuteMusicButton {
        if (!MuteMusicButton.instance) {
            MuteMusicButton.instance = new MuteMusicButton()
        }
        return MuteMusicButton.instance
    }

    /**
     * Initialize and show the music mute button
     */
    public initialize(onClick?: MuteButtonClickCallback): void {
        this.onClickCallback = onClick || null
        this.createButton()
        this.show()
    }

    /**
     * Create the music mute button element using UISystem
     */
    private createButton(): void {
        if (this._uiElement) {
            return
        }

        // Ensure UISystem is initialized
        UISystem.initialize()

        // Add mute button styles to document head
        this.addMuteMusicButtonStyles()

        // Create button using UISystem.createHUD for proper inset handling
        // Position on right side, below shop button
        this._uiElement = UISystem.createHUD(
            "mute-music-button",
            "",
            { x: window.innerWidth - 90, y: 190 }, // Right side, below shop button
        )

        // Add mute button specific class
        this._uiElement.element.classList.add("ui-mute-music-button")

        // Style with consistent UISystem approach (like ShopButton and MoneyUI)
        // Use cssText = (not +=) to completely override UISystem defaults
        // Purple gradient to differentiate from all-audio mute button
        this._uiElement.element.style.cssText = `
          position: absolute !important;
          top: 190px !important;
          right: 20px !important;
          left: auto !important;
          width: 60px !important;
          height: 60px !important;
          background: linear-gradient(135deg, #a855f7 0%, #7c3aed 100%) !important;
          color: white !important;
          border-radius: 50% !important;
          box-shadow: 0 4px 0 #6d28d9, 0 8px 15px rgba(168, 85, 247, 0.3) !important;
          cursor: pointer !important;
          display: flex !important;
          align-items: center !important;
          justify-content: center !important;
          z-index: 1001 !important;
          pointer-events: auto !important;
          transition: all 0.2s ease !important;
          user-select: none !important;
          opacity: 0.9 !important;
          padding: 0 !important;
          margin: 0 !important;
          border: none !important;
          outline: none !important;
          box-sizing: border-box !important;
          min-width: 60px !important;
          min-height: 60px !important;
          max-width: 60px !important;
          max-height: 60px !important;
        `

        // Add click handler
        this._uiElement.element.addEventListener("click", () => {
            this.handleClick()
        })

        // Set initial icon
        this.updateButtonIcon()
    }

    /**
     * Add music mute button styles to document head
     */
    private addMuteMusicButtonStyles(): void {
        if (!document.querySelector("#mute-music-button-icon-style")) {
            const iconStyle = document.createElement("style")
            iconStyle.id = "mute-music-button-icon-style"
            iconStyle.textContent = `
        .ui-mute-music-button:hover {
          opacity: 1 !important;
          transform: scale(1.05) !important;
        }

        .ui-mute-music-button:active {
          transform: scale(0.95) !important;
          box-shadow: 0 2px 0 #6d28d9, 0 4px 8px rgba(168, 85, 247, 0.2) !important;
        }

        .ui-mute-music-button.muted {
          background: linear-gradient(135deg, #6b7280 0%, #4b5563 100%) !important;
          box-shadow: 0 4px 0 #374151, 0 8px 15px rgba(107, 114, 128, 0.3) !important;
          opacity: 0.7 !important;
        }

        @media (max-width: 768px) {
          .ui-mute-music-button {
            width: 50px !important;
            height: 50px !important;
            font-size: 24px !important;
          }
        }
      `
            document.head.appendChild(iconStyle)
        }
    }

    /**
     * Handle button click
     */
    private handleClick(): void {
        this.toggleMute()

        if (this.onClickCallback) {
            this.onClickCallback()
        }
    }

    /**
     * Toggle mute state
     */
    public toggleMute(): void {
        this._isMuted = !this._isMuted
        this.updateButtonIcon()
    }

    /**
     * Set mute state
     */
    public setMuted(muted: boolean): void {
        this._isMuted = muted
        this.updateButtonIcon()
    }

    /**
     * Get current mute state
     */
    public get isMuted(): boolean {
        return this._isMuted
    }

    /**
     * Get the icon for music playing state
     */
    private getMusicOnIcon(): string {
        return `<img src="assets/cozy_game_general/headphones.svg" width="32" height="32" style="filter: brightness(0) invert(1);" alt="Music on" />`
    }

    /**
     * Get the icon for music muted state
     */
    private getMusicOffIcon(): string {
        return `<img src="assets/cozy_game_general/headphone-off.svg" width="32" height="32" style="filter: brightness(0) invert(1);" alt="Music off" />`
    }

    /**
     * Update the button icon based on mute state
     */
    private updateButtonIcon(): void {
        if (this._uiElement && this._uiElement.element) {
            this._uiElement.element.innerHTML = this._isMuted ? this.getMusicOffIcon() : this.getMusicOnIcon()
            if (this._isMuted) {
                this._uiElement.element.classList.add("muted")
            } else {
                this._uiElement.element.classList.remove("muted")
            }
        }
    }

    /**
     * Show the music mute button
     */
    public show(): void {
        if (this._uiElement && !this._isVisible) {
            this._uiElement.element.style.display = "flex"
            this._isVisible = true
        }
    }

    /**
     * Hide the music mute button
     */
    public hide(): void {
        if (this._uiElement && this._isVisible) {
            this._uiElement.element.style.display = "none"
            this._isVisible = false
        }
    }

    /**
     * Clean up the button
     */
    public destroy(): void {
        if (this._uiElement) {
            this._uiElement.remove()
            this._uiElement = null
        }
        this._isVisible = false
    }
}
