import { Component } from "@series-inc/rundot-3d-engine"
import { AnimationGraphComponent } from "@series-inc/rundot-3d-engine/systems"
import { BurgerCharacterDisplay } from "../character/BurgerCharacterDisplay"

/**
 * Animation component for burger shop characters
 * Uses decision trees for control flow (NOT for blending)
 */
export class CashierAnimator extends Component {
    private animationGraph: AnimationGraphComponent | null = null
    private characterDisplay: BurgerCharacterDisplay | null = null

    protected onCreate(): void {
        this.setupAnimation()
    }

    /**
     * Setup animation system - finds BurgerCharacterDisplay on same GameObject
     */
    private setupAnimation(): void {
        // Find the character display component on the same GameObject
        this.characterDisplay = this.gameObject.getComponent(BurgerCharacterDisplay) || null
        if (!this.characterDisplay) {
            console.error("BurgerCharacterAnimator: No BurgerCharacterDisplay found on GameObject. Add BurgerCharacterDisplay first.")
            return
        }

        // Wait a frame for skeletal model to be ready
        setTimeout(() => this.setupAnimationGraph(), 0)
    }

    /**
     * Setup animation graph with decision trees for organization
     */
    private setupAnimationGraph(): void {
        if (!this.characterDisplay) return

        // Check if skeletal model is ready
        const skeletalModel = this.characterDisplay.getSkeletalModel()
        if (!skeletalModel) {
            console.error("BurgerCharacterAnimator: Skeletal model not ready yet")
            return
        }

        const variationSeed = Math.random()

        // Create animation component with state machine and decision trees
        this.animationGraph = new AnimationGraphComponent(skeletalModel, {
            parameters: {
                movement_speed: { type: "float", default: 0.0 },
                using_register: { type: "bool", default: false },
                hand_over_item: { type: "bool", default: false },
            },

            states: {
                // Normal movement state - uses tree to pick animation based on speed
                idle: {
                    tree: {
                        parameter: "movement_speed",
                        children: [
                            { animation: "idle", threshold: 0.0 },
                            { animation: "walk", threshold: 0.2 }  // Switch to walk when speed > 0.2
                        ]
                    }
                },
                using_register: {
                    animation: "idle_cashier"
                },
                hand_over_item: {
                    animation: "throw"
                }
            },

            transitions: [
                { from: "idle", to: "using_register", when: { using_register: true } },
                { from: "using_register", to: "hand_over_item", when: { using_register: false } },
                { from: "hand_over_item", to: "idle", exitTime: 1.0 },
            ],

            initialState: "idle",
            debug: false
        })

        this.gameObject.addComponent(this.animationGraph)

        this.animationGraph?.setParameter("variation_seed", variationSeed)
    }

    // ========== Public Animation API ==========

    public setUsingRegister(usingRegister: boolean): void {
        this.animationGraph?.setParameter("using_register", usingRegister)
    }

    public setHandOverItem(handOverItem: boolean): void {
        if (this.animationGraph?.getParameter("hand_over_item") !== handOverItem) {
            console.log("CashierAnimator: Setting hand_over_item to", handOverItem)
        }
        this.animationGraph?.setParameter("hand_over_item", handOverItem)
    }

    /**
     * Get current animation state
     */
    public getCurrentState(): string | null {
        return this.animationGraph?.getCurrentState() || null
    }

    /**
     * Get current movement speed parameter
     */
    public getMovementSpeed(): number {
        return this.animationGraph?.getParameter("movement_speed") || 0.0
    }

    // ========== Component Lifecycle ==========

    protected onCleanup(): void {
        console.log("BurgerCharacterAnimator: Cleaning up")
    }
}