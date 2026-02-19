import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"

type AnimationCompletionCallback = () => void;

/**
 * Abstract base class for inventory items in Three.js
 */
export abstract class Item extends Component {
  /** The type of the item (e.g., "burger", "ingredient", "tool") */
  public abstract readonly itemType: string

  private animationTime: number = 0
  private animationDuration: number = 0.35
  private isAnimatingPosition: boolean = false
  private targetParent: GameObject | null = null
  private animationCompleteCallback?: AnimationCompletionCallback

  public get isAnimating() {
    return this.isAnimatingPosition
  }

  /**
   * Set the position of the item in world space
   */
  public setPosition(position: THREE.Vector3): void {
    if (!this.gameObject) {
      console.error("Cannot set position: Item is not attached to a GameObject")
      return
    }
    this.gameObject.position.copy(position)
  }

  /**
   * Get the position of the item in world space
   */
  public getPosition(): THREE.Vector3 {
    if (!this.gameObject) {
      console.error("Cannot get position: Item is not attached to a GameObject")
      return new THREE.Vector3()
    }
    return this.gameObject.position.clone()
  }

  /**
   * Set the rotation of the item in world space
   */
  public setRotation(rotation: THREE.Euler): void {
    if (!this.gameObject) {
      console.error("Cannot set rotation: Item is not attached to a GameObject")
      return
    }
    this.gameObject.rotation.copy(rotation)
  }

  /**
   * Get the rotation of the item in world space
   */
  public getRotation(): THREE.Euler {
    if (!this.gameObject) {
      console.error("Cannot get rotation: Item is not attached to a GameObject")
      return new THREE.Euler()
    }
    return this.gameObject.rotation.clone()
  }

  /**
   * Set the parent of the item's GameObject
   */
  public setParent(parent: GameObject): void {
    if (!this.gameObject) {
      console.error("Cannot set parent: Item is not attached to a GameObject")
      return
    }
    parent.add(this.gameObject)
  }

  /**
   * Get dimensions of the item for stacking
   * Override this in derived classes to provide accurate dimensions
   */
  public abstract getDimensions(): THREE.Vector3

  /**
   * Show the item
   */
  public show(): void {
    this.gameObject.visible = true
  }

  /**
   * Hide the item
   */
  public hide(): void {
    this.gameObject.visible = false
  }

  /**
   * Check if the item is visible
   */
  public isVisible(): boolean {
    return this.gameObject.visible
  }

  /**
   * Get the underlying GameObject
   */
  public getGameObject(): GameObject {
    return this.gameObject
  }

  public update(deltaTime: number) {
    if (this.isAnimatingPosition) {
      const targetParent = this.targetParent!;
      const startWorldPos = this.gameObject.parent!.localToWorld(this.getPosition());
      const targetWorldPos = new THREE.Vector3();
      targetParent.getWorldPosition(targetWorldPos);

      // Update time progress
      this.animationTime += deltaTime;
      const t = Math.min(this.animationTime / this.animationDuration, 1);

      // Ease-in-out for horizontal movement (fast -> slow -> fast)
      const easedT = t < 0.5
        ? 2 * t * t
        : 1 - Math.pow(-2 * t + 2, 2) / 2;

      const newWorldPos = startWorldPos.clone().lerp(targetWorldPos, easedT);

      // Parabolic arc with the same easing for natural throw
      const height = 1.5;
      const arc = height * 4 * easedT * (1 - easedT);

      newWorldPos.y += arc;

      // Convert back to local space and apply
      const newLocalPos = this.gameObject.parent!.worldToLocal(newWorldPos);
      this.setPosition(newLocalPos);

      // Finish animation
      if (t >= 1) {
        this.setParent(targetParent);
        this.setPosition(new THREE.Vector3(0, 0, 0));
        this.isAnimatingPosition = false;
        this.animationTime = 0;
        this.animationCompleteCallback?.()
      }
    }
  }

  /**
   * Clean up resources when item is removed
   */
  protected onCleanup(): void {
    // Base cleanup - derived classes can override
  }

  public animateToPosition(targetParent: GameObject, onCompleteCallback?: AnimationCompletionCallback) {
    this.unparent(this.gameObject)
    this.targetParent = targetParent
    this.isAnimatingPosition = true
    this.animationCompleteCallback = onCompleteCallback
  }

  private unparent(obj: GameObject) {
    const pos = new THREE.Vector3();
    const quat = new THREE.Quaternion();
    const scale = new THREE.Vector3();

    obj.getWorldPosition(pos);
    obj.getWorldQuaternion(quat);
    obj.getWorldScale(scale);

    const scene = this.scene

    if (obj.parent) obj.parent.remove(obj);
    scene.add(obj)

    obj.position.copy(pos);
    obj.quaternion.copy(quat);
    obj.scale.copy(scale);
  }
}
