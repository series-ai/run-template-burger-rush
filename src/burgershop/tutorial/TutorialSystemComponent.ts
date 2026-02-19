import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { TutorialTracker } from "./TutorialTracker"
import { UISystem } from "@series-inc/rundot-3d-engine/systems"
import RundotGameAPI from "@series-inc/rundot-game-sdk/api"
import { TargetPointer } from "@game/target-pointer/TargetPointer"

export interface TutorialStep {
  id: string
  description: string
  displayCondition?: () => boolean
  completeCondition: () => boolean
  targetPosition?: THREE.Vector3 | (() => THREE.Vector3 | undefined) // Optional world position to point at (static or dynamic)
  targetYOffset?: number // Optional height offset for the pointer
}

interface TutorialStepUI {
  step: TutorialStep
  getStepId(): string
  show(): void
  hide(): void
  dispose(): void
}

export class TutorialSystemComponent extends Component {
  private tutorialSteps: TutorialStep[] = []
  private currentStepUI: TutorialStepUI | null = null
  private tracker: TutorialTracker = TutorialTracker.getInstance()
  private tutorialElement: HTMLElement | null = null
  private isResetting: boolean = false
  private unorderedStartIndex: number = Number.MAX_SAFE_INTEGER // Index where linear progression ends
  private isEnabled: boolean = true // Whether the tutorial system is active
  
  // Target pointer system
  private targetPointerObject: GameObject | null = null
  private targetPointer: TargetPointer | null = null
  private camera: THREE.Camera | null = null

  public setTutorialSteps(steps: TutorialStep[], unorderedStartIndex?: number): void {
    this.tutorialSteps = steps
    this.unorderedStartIndex = unorderedStartIndex ?? steps.length // Default: all steps are linear
    this.tracker.initAllTutorialSteps(steps.map(step => step.id))
  }
  
  /**
   * Set the camera for target pointer projection
   */
  public setCamera(camera: THREE.Camera): void {
    this.camera = camera
    if (this.targetPointer) {
      this.targetPointer.setCamera(camera)
    }
  }

  /**
   * Enable or disable the tutorial system
   * When disabled, no tutorial steps will be shown
   */
  public setEnabled(enabled: boolean): void {
    this.isEnabled = enabled
    
    // If disabling, hide any current tutorial step
    if (!enabled && this.currentStepUI) {
      this.currentStepUI.hide()
      this.currentStepUI = null
    }
  }

  protected onCreate(): void {
    this.createTargetPointer()
    console.log("🎯 Tutorial system UI component initialized")
  }
  
  /**
   * Create the target pointer for tutorial steps
   */
  private createTargetPointer(): void {
    this.targetPointerObject = new GameObject("TutorialTargetPointer")
    this.gameObject.add(this.targetPointerObject)
    
    this.targetPointer = new TargetPointer()
    this.targetPointerObject.addComponent(this.targetPointer)
    
    if (this.camera) {
      this.targetPointer.setCamera(this.camera)
    }
  }


  public update(deltaTime: number): void {
    if (this.isResetting || !this.isEnabled) return

    this.tracker.update()
    this.autoCompleteSteps()

    const nextStep = this.getNextTutorialStep()

    if (nextStep && !this.currentStepUI) {
      this.createTutorialUI(nextStep)
    } else if (this.currentStepUI) {
      const currentStepId = this.currentStepUI.getStepId()
      const currentStep = this.tutorialSteps.find(
        (step) => step.id === currentStepId,
      )

      if (currentStep && currentStep.completeCondition()) {
        this.completeStep(currentStepId)
      }
    }
  }

  private autoCompleteSteps(): void {
    if (this.isResetting) return

    this.tutorialSteps.forEach((step) => {
      if (this.tracker.isStepCompleted(step.id)) return

      if (step.completeCondition()) {
        this.completeStep(step.id)
      }
    })
  }

  private getNextTutorialStep(): TutorialStep | null {
    for (let i = 0; i < this.tutorialSteps.length; i++) {
      const step = this.tutorialSteps[i]
      
      if (this.tracker.isStepCompleted(step.id)) {
        continue // Skip completed steps
      }

      // Check if step can be displayed
      const displayCondition = step.displayCondition ?? (() => true)
      if (displayCondition()) {
        return step
      }
      
      // Linear steps (before unorderedStartIndex) block progression
      // Unordered steps (after unorderedStartIndex) don't block - keep checking
      if (i < this.unorderedStartIndex) {
        return null // Blocked - linear progression
      }
    }
    return null
  }

  private createTutorialUI(step: TutorialStep): void {
    this.currentStepUI = {
      step,
      getStepId: () => step.id,
      show: () => this.showTutorialStep(step),
      hide: () => this.hideTutorialStep(),
      dispose: () => this.hideTutorialStep(),
    }
    this.currentStepUI.show()
  }

  private showTutorialStep(step: TutorialStep): void {
    if (this.tutorialElement) {
      this.tutorialElement.remove()
    }

    this.tutorialElement = document.createElement("div")
    this.tutorialElement.className = "ui-tutorial-step"

    this.tutorialElement.innerHTML = `
      <div style="
        color: #ffffff;
        animation: tutorial-fade-in 0.5s ease-out;
        text-align: center;
      ">
        <p style="
          margin: 0;
          font-size: 24px;
          line-height: 1.4;
          font-weight: 600;
          text-shadow: 2px 2px 4px rgba(0,0,0,0.8);
          max-width: 400px;
          word-wrap: break-word;
        ">${step.description}</p>
      </div>
    `

    this.tutorialElement.style.cssText = `
      position: fixed;
      top: 15%;
      left: 50%;
      transform: translateX(-50%) translateY(-50%);
      transform-origin: center;
      z-index: 1000;
      pointer-events: none;
      font-family: var(--game-font);
    `

    if (!document.getElementById("tutorial-styles")) {
      const style = document.createElement("style")
      style.id = "tutorial-styles"
      style.textContent = `
        @keyframes tutorial-fade-in {
          0% {
            opacity: 0;
            transform: translateY(-10px) scale(0.95);
          }
          100% {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `
      document.head.appendChild(style)
    }

    // Append to UISystem container to respect safe area insets
    const container = document.getElementById("ui-system-three")
    if (container) {
      container.appendChild(this.tutorialElement)
    } else {
      // Fallback to body if UISystem not initialized
      document.body.appendChild(this.tutorialElement)
    }
    
    // Update target pointer if step has a target position
    const targetPos = this.resolveTargetPosition(step)
    if (this.targetPointer && targetPos) {
      this.targetPointer.setTarget(targetPos, step.targetYOffset)
      if (this.targetPointerObject) {
        this.targetPointerObject.setEnabled(true)
      }
    } else if (this.targetPointerObject) {
      // Hide pointer if step has no target position
      this.targetPointerObject.setEnabled(false)
    }
  }

  /**
   * Resolve target position from static Vector3 or dynamic function
   */
  private resolveTargetPosition(step: TutorialStep): THREE.Vector3 | undefined {
    if (!step.targetPosition) return undefined
    if (typeof step.targetPosition === 'function') {
      return step.targetPosition()
    }
    return step.targetPosition
  }

  private hideTutorialStep(): void {
    if (this.tutorialElement) {
      this.tutorialElement.remove()
      this.tutorialElement = null
    }
    
    // Hide target pointer when tutorial step is hidden
    if (this.targetPointerObject) {
      this.targetPointerObject.setEnabled(false)
    }
  }

  public completeStep(stepId: string): void {
    if (!this.tracker.isStepCompleted(stepId)) {
      if (!this.isResetting) {
        this.tracker.completeStep(stepId)
      }

      if (this.currentStepUI && this.currentStepUI.getStepId() === stepId) {
        this.currentStepUI.hide()
        this.currentStepUI = null
      }
    }
  }

  public isStepCompleted(stepId: string): boolean {
    return this.tracker.isStepCompleted(stepId)
  }

  public getTracker(): TutorialTracker {
    return this.tracker
  }

  public getDebugInfo(): any {
    return {
      completedSteps: Array.from(this.tracker.getCompletedSteps()),
      currentStep: this.currentStepUI?.getStepId() || null,
      unorderedStartIndex: this.unorderedStartIndex,
      trackerInfo: this.tracker.getDebugInfo(),
    }
  }

  public getTutorialSteps(): TutorialStep[] {
    return [...this.tutorialSteps]
  }

  public async reset(): Promise<void> {
    console.log("🎯 Resetting tutorial progress...")
    this.isResetting = true
    
    await this.tracker.reset()

    if (this.currentStepUI) {
      this.currentStepUI.hide()
      this.currentStepUI = null
    }

    this.isResetting = false
    console.log("🎯 Tutorial progress reset complete!")
  }

  protected onCleanup(): void {
    if (this.currentStepUI) {
      this.currentStepUI.dispose()
    }
    if (this.tutorialElement) {
      this.tutorialElement.remove()
    }
    
    // Cleanup target pointer
    if (this.targetPointerObject) {
      this.targetPointerObject.setEnabled(false)
      this.targetPointerObject.dispose()
      this.targetPointerObject = null
      this.targetPointer = null
    }
  }
}
