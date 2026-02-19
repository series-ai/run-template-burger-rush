import { Component } from "@series-inc/rundot-3d-engine"
import { AnimationGraphComponent } from "@series-inc/rundot-3d-engine/systems"
import { BurgerCharacterDisplay } from "./BurgerCharacterDisplay"

/**
 * Animation component for burger shop characters
 * Uses decision trees for control flow (NOT for blending)
 */
export class BurgerCharacterAnimator extends Component {
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
        carrying: { type: "bool", default: false },
        eating: { type: "bool", default: false },
        using_bathroom: { type: "bool", default: false },
        waiting_for_bathroom: { type: "bool", default: false },
        waiting_for_cashier: { type: "bool", default: false },
        variation_seed: { type: "float", default: 0.0 },
        interacting_kiosk: { type: "bool", default: false }
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
        
        // Carrying state - uses tree for idle vs walk while carrying
        carrying: {
          tree: {
            parameter: "movement_speed",
            children: [
              { animation: "carry_idle", threshold: 0.0 },
              { animation: "carry_walk", threshold: 0.2 }
            ]
          }
        },
        
        // Eating state - simple single animation
        eating: {
          tree: {
            parameter: "variation_seed",
            children: [
              { animation: "sitting_eating", threshold: 0.0 },
              { animation: "sitting_eating_shovel", threshold: 0.5 }
            ]
          }
        },

        idle_to_bathroom: {
          animation: "idle_to_toilet"
        },
        using_bathroom: {
          animation: "using_bathroom"
        },

        interacting_kiosk: {
          animation: "interact_kiosk"
        },

        waiting_cashier_idle: {
          randomizeStartTime: true,
          tree: {
            parameter: "movement_speed",
            children: [
              { animation: variationSeed < 0.5 ? "idle_wait" : "idle", threshold: 0.0 },
              { animation: "walk", threshold: 0.2 }
            ]
          }
        },

        // Waiting for bathroom state - uses tree to pick animation based on speed
        waiting_bathroom_idle: {
          randomizeStartTime: true,
          tree: {
            parameter: "movement_speed",
            children: [
              { animation: variationSeed < 0.60 ? "pee_dance" : "idle_wait", threshold: 0.0 },
              { animation: "walk", threshold: 0.2 }  // Switch to walk when speed > 0.2
            ]
          }
        }
      },
      
      transitions: [
        { from: "idle", to: "carrying", when: { carrying: true } },
        { from: "idle", to: "idle_to_bathroom", when: { using_bathroom: true } },
        { from: "idle", to: "eating", when: { eating: true } },
        { from: "idle", to: "waiting_bathroom_idle", when: { waiting_for_bathroom: true } },
        { from: "idle", to: "waiting_cashier_idle", when: { waiting_for_cashier: true } },
        { from: "idle", to: "interacting_kiosk", when: { interacting_kiosk: true } },
        { from: "carrying", to: "idle", when: { carrying: false } },
        { from: "carrying", to: "eating", when: { eating: true } },
        { from: "eating", to: "idle", when: { eating: false } },
        { from: "idle_to_bathroom", to: "using_bathroom", exitTime: 1.0 },
        { from: "using_bathroom", to: "idle", when: { using_bathroom: false } },
        { from: "waiting_bathroom_idle", to: "idle", when: { waiting_for_bathroom: false } },
        { from: "waiting_bathroom_idle", to: "using_bathroom", when: { using_bathroom: true } },
        { from: "waiting_cashier_idle", to: "idle", when: { waiting_for_cashier: false } },
        { from: "waiting_cashier_idle", to: "carrying", when: { carrying: true } },
        { from: "waiting_cashier_idle", to: "interacting_kiosk", when: { interacting_kiosk: true } },
        { from: "interacting_kiosk", to: "idle", when: { interacting_kiosk: false } },
        { from: "interacting_kiosk", to: "carrying", when: { carrying: true } },
      ],
      
      initialState: "idle",
      debug: false
    })

    this.gameObject.addComponent(this.animationGraph)

    this.animationGraph?.setParameter("variation_seed", variationSeed)
  }

  // ========== Public Animation API ==========

  /**
   * Set character movement speed (0.0 = idle, 1.0 = max speed)
   */
  public setMovementSpeed(speed: number): void {
    this.animationGraph?.setParameter("movement_speed", Math.max(0, Math.min(1, speed)))
  }

  /**
   * Set whether character is carrying items
   */
  public setCarrying(carrying: boolean): void {
    this.animationGraph?.setParameter("carrying", carrying)
  }

  /**
   * Set whether character is eating (for customers)
   */
  public setEating(eating: boolean): void {
    this.animationGraph?.setParameter("eating", eating)
  }

  /**
   * Set whether character is using the bathroom (for customers)
   */
  public setUsingBathroom(usingBathroom: boolean): void {
    this.animationGraph?.setParameter("using_bathroom", usingBathroom)
  }

  /**
   * Set whether character is waiting for the bathroom (for customers)
   */
  public setWaitingForBathroom(waitingForBathroom: boolean): void {
    this.animationGraph?.setParameter("waiting_for_bathroom", waitingForBathroom)
  }

  /**
   * Set whether character is waiting for the cashier (for customers)
   */
  public setWaitingForCashier(waitingForCashier: boolean): void {
    this.animationGraph?.setParameter("waiting_for_cashier", waitingForCashier)
  }

  /**
   * Set whether character is interacting with the kiosk (for customers)
   */
  public setInteractingKiosk(interactingKiosk: boolean): void {
    this.animationGraph?.setParameter("interacting_kiosk", interactingKiosk)
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

  /**
   * Get current carrying state
   */
  public isCarrying(): boolean {
    return this.animationGraph?.getParameter("carrying") || false
  }

  /**
   * Get current eating state
   */
  public isEating(): boolean {
    return this.animationGraph?.getParameter("eating") || false
  }

  // ========== Component Lifecycle ==========

  protected onCleanup(): void {
    console.log("BurgerCharacterAnimator: Cleaning up")
  }
}