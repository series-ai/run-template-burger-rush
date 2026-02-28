import { Component } from "@series-inc/rundot-3d-engine"
import { BurgerCharacterDisplay } from "../character"
import { CashierAnimator } from "./CashierAnimator"

export class Cashier extends Component {
    public getLevel(): number {
        return this.level;
    }

    private level: number = 1;

    // Character components
    private characterDisplay!: BurgerCharacterDisplay
    private characterAnimator!: CashierAnimator

    constructor() {
        super()
    }

    protected onCreate(): void {
        this.setupCharacterComponents()
        this.characterAnimator.setUsingRegister(false)
        this.characterAnimator.setHandOverItem(false)
    }

    private setupCharacterComponents(): void {
        // 1. Create character display first
        this.characterDisplay = new BurgerCharacterDisplay("stowkit://character_cashier")
        this.gameObject.addComponent(this.characterDisplay)
    
        // 2. Create character animator (finds display automatically)
        this.characterAnimator = new CashierAnimator()
        this.gameObject.addComponent(this.characterAnimator)
    }

    public setUsingRegister(usingRegister: boolean): void {
        this.characterAnimator.setUsingRegister(usingRegister)
    }
}

export class CanCheckout extends Component {
}
