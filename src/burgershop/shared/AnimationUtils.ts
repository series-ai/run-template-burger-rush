import { GameObject } from "@series-inc/rundot-3d-engine"
import { TweenSystem, Easing } from "@series-inc/rundot-3d-engine/systems"
import * as THREE from "three"

/**
 * Reusable animation utilities for objects in the game
 * Provides bounce in/out animations for creating and destroying objects
 */
export class AnimationUtils {
  /**
   * Animate an object bouncing out (shrinking down) before removal
   * @param gameObject The object to animate
   * @param onComplete Callback when animation completes
   * @param duration Duration of the animation in seconds (default: 0.5)
   */
  public static animateOut(
    gameObject: GameObject,
    onComplete?: () => void,
    duration: number = 0.5
  ): void {
    // Only animate Y axis so it shrinks down into the ground
    const yTween = TweenSystem.tween(
      gameObject.scale,
      "y",
      0,
      duration,
      (t: number) => Easing.easeInBack(t)
    )
    
    yTween.onCompleted(() => {
      if (onComplete) {
        onComplete()
      }
    })
  }

  /**
   * Animate an object bouncing in (growing from small to normal size)
   * @param gameObject The object to animate
   * @param onComplete Callback when animation completes
   * @param duration Duration of the animation in seconds (default: 0.75)
   * @param targetScale Optional target scale (defaults to 1.0)
   */
  public static animateIn(
    gameObject: GameObject,
    onComplete?: () => void,
    duration: number = 0.75,
    targetScale: number = 1.0
  ): void {
    // Start at 0 scale on Y axis only
    gameObject.scale.y = 0
    
    // Bounce up to target scale with spring easing (only Y axis)
    const yTween = TweenSystem.tween(
      gameObject.scale,
      "y",
      targetScale,
      duration,
      (t: number) => Easing.spring(t, 3, 1.5)
    )
    
    yTween.onCompleted(() => {
      // Ensure exact scale (fix floating point errors)
      gameObject.scale.y = targetScale
      if (onComplete) {
        onComplete()
      }
    })
  }

  /**
   * Animate replacing one object with another
   * First bounces out the old object, then bounces in the new one
   * @param oldObject The object to remove
   * @param newObject The object to show
   * @param onOldRemoved Callback after old object animation completes (before new appears)
   * @param onComplete Callback when entire animation completes
   * @param outDuration Duration of the out animation (default: 0.5)
   * @param inDuration Duration of the in animation (default: 0.75)
   */
  public static animateReplace(
    oldObject: GameObject,
    newObject: GameObject,
    onOldRemoved?: () => void,
    onComplete?: () => void,
    outDuration: number = 0.5,
    inDuration: number = 0.75
  ): void {
    // Hide new object initially
    newObject.setEnabled(false)
    
    // Animate out the old object
    this.animateOut(oldObject, () => {
      // Old object animation done
      if (onOldRemoved) {
        onOldRemoved()
      }
      
      // Show and animate in the new object
      newObject.setEnabled(true)
      this.animateIn(newObject, onComplete, inDuration, 1.0) // Use explicit duration and scale for replace
    })
  }

  /**
   * Quick bounce animation for feedback (like the trash can bounce)
   * @param gameObject The object to bounce
   * @param axis The axis to bounce on ('x', 'y', or 'z')
   * @param bounceAmount How much to stretch (default: 1.2 = 20% larger)
   * @param duration Duration of the bounce (default: 0.5)
   */
  public static quickBounce(
    gameObject: GameObject,
    axis: 'x' | 'y' | 'z' = 'y',
    bounceAmount: number = 1.2,
    duration: number = 0.5
  ): void {
    const originalScale = gameObject.scale[axis]
    
    // Set initial bounce state
    gameObject.scale[axis] = bounceAmount
    
    // Settle back down with spring
    const settleTween = TweenSystem.tween(
      gameObject.scale,
      axis,
      originalScale,
      duration,
      (t: number) => Easing.spring(t, 2.5, 1.5)
    )
    
    settleTween.onCompleted(() => {
      // Ensure exact scale
      gameObject.scale[axis] = originalScale
    })
  }

  /**
   * Squash bounce animation - smoothly squashes down then springs back up
   * If called mid-animation, squashes from current scale for smooth layering
   * @param gameObject The object to bounce
   * @param squashTarget Target squash scale (default: 0.88)
   * @param squashDuration Duration of squash down (default: 0.15)
   * @param bounceDuration Duration of the bounce back (default: 0.7)
   */
  public static squashBounce(
    gameObject: GameObject,
    squashTarget: number = 0.88,
    squashDuration: number = 0.15,
    bounceDuration: number = 0.7
  ): void {
    // Calculate squash target based on current scale (allows layering)
    const currentScale = gameObject.scale.y
    const targetSquash = Math.min(currentScale, squashTarget)
    
    // Smooth squash down
    const squashTween = TweenSystem.tween(
      gameObject.scale,
      "y",
      targetSquash,
      squashDuration,
      (t: number) => Easing.easeOutQuad(t)
    )
    
    squashTween.onCompleted(() => {
      // Spring back up to 1.0
      const springTween = TweenSystem.tween(
        gameObject.scale,
        "y",
        1.0,
        bounceDuration,
        (t: number) => Easing.spring(t, 2, 0.8)
      )
      
      springTween.onCompleted(() => {
        gameObject.scale.y = 1.0
      })
    })
  }
}

