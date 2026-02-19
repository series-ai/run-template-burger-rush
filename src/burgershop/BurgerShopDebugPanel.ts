import * as THREE from "three"
import { DebugPanelThree as DebugPanel } from "@series-inc/rundot-3d-engine/systems"
import { AnimationGraphComponent } from "@series-inc/rundot-3d-engine/systems"
import { UnlockManager } from "./money"
import { PlayerComponent } from "./PlayerComponent"
import { PremiumCurrencySystem } from "./premium-currency"
import { UpgradeManager } from "./upgrade-station/UpgradeManager"

/**
 * Interface for objects that support free camera controls
 */
interface FreeCameraController {
  setFreeCameraEnabled(enabled: boolean): void
  isFreeCameraEnabled(): boolean
  getCamera?(): THREE.Camera | null
}

/**
 * Burger Shop specific debug panel that extends the base DebugPanel
 * Base panel already has working: Performance Stats, Physics Debug, Navigation Debug, Post Processing
 * This just adds burger shop specific options at the end
 */
export class BurgerShopDebugPanel extends DebugPanel {
  private freeCameraController: FreeCameraController | null = null
  private cameraDebugElement: HTMLDivElement | null = null
  private cameraDebugInterval: number | null = null

  constructor(freeCameraController?: FreeCameraController) {
    super() // Create base panel with all working functionality
    this.freeCameraController = freeCameraController || null
    this.hideUnwantedOptions() // Hide options we don't want
    this.addBurgerShopOptions() // Add burger shop specific options
  }

  /**
   * Hide debug options we don't want from the base class
   */
  private hideUnwantedOptions(): void {
    // Wait a frame for the DOM elements to be created, then hide unwanted options
    setTimeout(() => {
      const optionsToHide = [
        "Print Instance Report",
        "Path Visualization",
        "Hide Skinned Meshes",
        "Hide Blob Shadows",
        "Real Character Shadows",
        "Bake Instancing",
      ]
      
      for (const label of optionsToHide) {
        const checkbox = document.querySelector(
          `input[type="checkbox"][data-label="${label}"]`
        ) as HTMLInputElement
        if (checkbox && checkbox.parentElement) {
          checkbox.parentElement.style.display = 'none'
        }
      }
    }, 0)
  }

  /**
   * Add burger shop specific debug options
   * These appear after the base options (Performance, Physics, Navigation, Post Processing)
   */
  private addBurgerShopOptions(): void {
    // Add Free Camera option (like the original Babylon.js system)
    if (this.freeCameraController) {
      this.addOption("Free Camera", false, (checked) => {
        this.freeCameraController!.setFreeCameraEnabled(checked)
        
        if (checked) {
          this.showCameraDebug()
        } else {
          this.hideCameraDebug()
        }
      })
    }

    // Add Fast Player Speed option (sets speed to 10.5 for fast movement)
    this.addOption("Fast Player Speed", false, (checked) => {
      if (checked) {
        PlayerComponent.speed = 10.5
      } else {
        // Use UpgradeManager to restore the correct upgraded speed
        UpgradeManager.setSpeedBoost(false)
      }
    })

    // Add Animator Debug View option
    this.addOption("Animator Debug", false, (checked) => {
      AnimationGraphComponent.setDebugViewEnabled(checked)
    })

    // Drive-thru Spline Debug option - commented out per user request
    /*
    this.addOption("Drive-thru Spline", false, (checked) => {
      // Access the demo instance through the free camera controller (which is the demo)
      const demo = this.freeCameraController as any
      if (demo && demo.driveThru) {
        // Get the car manager from the drive-thru component
        const carManager = demo.driveThru.getCarManager()
        if (carManager) {
          const driveThruSpline = carManager.getDriveThruSpline()
          if (driveThruSpline) {
            driveThruSpline.setDebugEnabled(checked)
            // Drive-thru spline visualization toggled
          } else {
            console.warn("Drive-thru spline not found or not initialized yet")
          }
        } else {
          console.warn(
            "Car manager not found - drive-thru may not be unlocked yet",
          )
        }
      } else {
        console.warn("Drive-thru component not found")
      }
    })
    */

    // Tween Debug Logging toggle - commented out per user request
    /*
    this.addOption("Tween Logging", false, (checked) => {
      TweenSystem.debugLogging = checked
      if (checked) {
        const stats = TweenSystem.getStats()
        console.log(`[Debug] Tween logging enabled - Active: ${stats.active}, Pending: ${stats.pending}`)
      } else {
        console.log(`[Debug] Tween logging disabled`)
      }
    })
    */
    
    // Tween Stats display - commented out per user request
    /*
    let tweenStatsInterval: number | null = null
    this.addOption("Tween Stats", false, (checked) => {
      if (checked) {
        // Show stats immediately
        const stats = TweenSystem.getStats()
        console.log(`[TweenStats] Active: ${stats.active}, Pending: ${stats.pending}, Frame: ${stats.currentFrame}`)
        
        // Update stats every second
        tweenStatsInterval = window.setInterval(() => {
          const stats = TweenSystem.getStats()
          if (stats.active > 0 || stats.pending > 0) {
            console.log(`[TweenStats] Active: ${stats.active}, Pending: ${stats.pending}, Last Active: ${stats.currentFrame - stats.lastActiveFrame} frames ago`)
          }
        }, 1000)
      } else {
        // Clear the interval
        if (tweenStatsInterval !== null) {
          window.clearInterval(tweenStatsInterval)
          tweenStatsInterval = null
        }
        console.log(`[Debug] Tween stats monitoring disabled`)
      }
    })
    */

    // Add Animation Console Filter toggle
    this.addOption("Animation Warnings", true, async (checked) => {
      const { AnimationConsoleFilter } = await import("@series-inc/rundot-3d-engine/systems")
      if (checked) {
        AnimationConsoleFilter.enable()
      } else {
        AnimationConsoleFilter.disable()
      }
    })

    // Add unlock all option (one-time action)
    this.addOneTimeOption("Unlock All", () => {
      console.log("🔓 DEBUG: Unlocking all items for purchase!")
      UnlockManager.debugUnlockAll()
    })

    // Add purchase all option (one-time action)
    this.addOneTimeOption("Purchase All", () => {
      console.log("💰 DEBUG: Auto-purchasing all unlocked items!")
      UnlockManager.debugAcquireAll()
    })

    // Add give money option (one-time action)
    this.addOneTimeOption("Give Money ($10k)", () => {
      console.log("💰 DEBUG: Giving $10,000 for testing!")
      UnlockManager.debugGiveMoney(10000)
    })

    // Add give premium currency option (one-time action)
    this.addOneTimeOption("Give Premium Currency (100)", () => {
      console.log("💎 DEBUG: Giving 100 premium currency for testing!")
      const newAmount = PremiumCurrencySystem.addCurrency(100)
      console.log(`💎 Total premium currency: ${newAmount}`)
    })

    // Add clear all unlocks option (one-time action that refreshes page)
    this.addOneTimeOption("Clear All Progress", async () => {
      console.log("🧹 DEBUG: Clearing all progress and refreshing page!")
      
      // Use the global debugClearAllProgress function which includes tutorial reset
      if ((window as any).debugClearAllProgress) {
        await (window as any).debugClearAllProgress()
      } else {
        console.error("❌ debugClearAllProgress function not available")
      }
    })

    // Customer debug visuals option - commented out per user request
    /*
    this.addOption("Customer Debug UI", false, (checked) => {
      // Set global flag that customers can check
      ;(window as any).customerDebugEnabled = checked

      if (checked) {
        // Customer debug visuals enabled
        // Debug visuals are automatically created when customers spawn
      } else {
        // Customer debug visuals disabled
        // Call global cleanup function
        if ((window as any).removeDebugVisuals) {
          ;(window as any).removeDebugVisuals()
        }
      }
    })
    */

    // Shadow camera helper option - commented out per user request
    /*
    this.addOption("Shadow Bounds", false, (checked) => {
      const demo = (window as any).demo
      if (demo?.directionalLight?.shadow?.camera) {
        if (checked) {
          // Create and add shadow camera helper
          const helper = new THREE.CameraHelper(demo.directionalLight.shadow.camera)
          demo.scene.add(helper)
          ;(window as any).shadowCameraHelper = helper
        } else {
          // Remove shadow camera helper
          const helper = (window as any).shadowCameraHelper
          if (helper) {
            demo.scene.remove(helper)
            helper.dispose()
            delete (window as any).shadowCameraHelper
          }
        }
      }
    })
    */

    // Add disable ads option
    // this.addOption("Disable Ads", false, (checked) => {
    //   const demo = this.freeCameraController as any
    //   if (demo && demo.timedAdSystem) {
    //     // Set the enabled state (inverted because "Disable Ads" means not enabled)
    //     demo.timedAdSystem.setEnabled(!checked)
    //     if (checked) {
    //       console.log("🚫 DEBUG: Ads have been disabled")
    //     } else {
    //       console.log("✅ DEBUG: Ads have been re-enabled")
    //     }
    //   } else {
    //     console.warn("❌ DEBUG: TimedAdSystem not found - may not be initialized yet")
    //   }
    // })

    // Player position debug option - commented out per user request
    /*
    this.addOption("Player Position", false, (checked) => {
      // Create the display element if it doesn't exist yet
      if (!this.playerPositionElement) {
        this.createPlayerPositionDisplay()
      }
      if (this.playerPositionElement) {
        this.playerPositionElement.style.display = checked ? "block" : "none"
      }
    })
    */
  }

  /**
   * Helper method to add one-time action buttons (like the old Babylon.js debug panel)
   * These appear as checkboxes but automatically uncheck after execution
   */
  private addOneTimeOption(label: string, action: () => void): void {
    this.addOption(label, false, (checked) => {
      if (checked) {
        action()
        // Automatically uncheck the option after a brief delay
        setTimeout(() => {
          const option = this.getOption(label)
          if (option && option.checkbox) {
            option.checkbox.isChecked = false
          }
        }, 100)
      }
    })
  }

  /**
   * Helper to get an option by label (for unchecking one-time actions)
   */
  private getOption(label: string): any {
    return this.options.find((opt) => opt.label === label)
  }

  /**
   * Show camera position/rotation debug display
   */
  private showCameraDebug(): void {
    if (this.cameraDebugElement) return

    // Create the debug display element
    this.cameraDebugElement = document.createElement("div")
    this.cameraDebugElement.style.cssText = `
      position: fixed;
      top: 10px;
      left: 50%;
      transform: translateX(-50%);
      background: rgba(0, 0, 0, 0.85);
      color: #00ff00;
      font-family: 'Consolas', 'Monaco', monospace;
      font-size: 14px;
      padding: 12px 20px;
      border-radius: 8px;
      border: 1px solid #00ff00;
      z-index: 10000;
      pointer-events: none;
      white-space: pre;
      text-align: left;
    `
    document.body.appendChild(this.cameraDebugElement)

    // Update every frame
    this.cameraDebugInterval = window.setInterval(() => {
      this.updateCameraDebug()
    }, 100) // Update 10 times per second

    this.updateCameraDebug()
  }

  /**
   * Hide camera debug display
   */
  private hideCameraDebug(): void {
    if (this.cameraDebugInterval) {
      window.clearInterval(this.cameraDebugInterval)
      this.cameraDebugInterval = null
    }
    if (this.cameraDebugElement) {
      this.cameraDebugElement.remove()
      this.cameraDebugElement = null
    }
  }

  /**
   * Update the camera debug display with current values
   */
  private updateCameraDebug(): void {
    if (!this.cameraDebugElement || !this.freeCameraController) return

    const controller = this.freeCameraController as any
    const camera = controller.camera || controller.getCamera?.()
    
    if (!camera) {
      this.cameraDebugElement.textContent = "Camera not available"
      return
    }

    const pos = camera.position
    // Convert rotation to YXZ order for intuitive values
    const yxzEuler = new THREE.Euler().setFromQuaternion(camera.quaternion, "YXZ")

    // Format for easy copy-paste into code (using YXZ order)
    const posStr = `position: (${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)})`
    const xDeg = THREE.MathUtils.radToDeg(yxzEuler.x).toFixed(0)
    const yDeg = THREE.MathUtils.radToDeg(yxzEuler.y).toFixed(0)
    const zDeg = THREE.MathUtils.radToDeg(yxzEuler.z).toFixed(0)
    const rotDeg = `rotation (YXZ): X=${xDeg}° (pitch), Y=${yDeg}° (yaw), Z=${zDeg}° (roll)`

    this.cameraDebugElement.textContent = `📷 Camera Debug\n${posStr}\n${rotDeg}`
  }
}
