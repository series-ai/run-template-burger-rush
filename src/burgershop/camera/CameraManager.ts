import * as THREE from "three"
import { Component, GameObject } from "@series-inc/rundot-3d-engine"
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js"

/**
 * Camera modes
 */
export enum CameraMode {
  FOLLOW = "follow",
  FIXED = "fixed",
  FREE = "free",
  TRANSITIONING = "transitioning",
}

/**
 * Camera settings that apply to all modes
 */
export interface CameraSettings {
  fov: number
}

const DEFAULT_CAMERA_SETTINGS: CameraSettings = {
  fov: 32,
}

const DEG2RAD = Math.PI / 180

/**
 * Single source of truth for camera control.
 * Handles follow, fixed, and transition modes with a simple switch statement.
 * No more fighting between behavior classes.
 */
export class CameraManager extends Component {
  private camera: THREE.PerspectiveCamera | null = null
  private canvas: HTMLCanvasElement | null = null
  private target: GameObject | null = null
  private settings: CameraSettings = { ...DEFAULT_CAMERA_SETTINGS }
  private mode: CameraMode = CameraMode.FOLLOW
  private isStarted: boolean = false // Prevents updates until explicitly started or captured

  // ===== Follow mode state =====
  private followTarget: THREE.Vector3 = new THREE.Vector3()
  private cameraHeight: number = 56
  private cameraAlpha: number = 225 * DEG2RAD // horizontal angle
  private cameraBeta: number = 40 * DEG2RAD // vertical angle
  private followSpeed: number = 6.0

  // ===== Fixed mode state =====
  private fixedPosition: THREE.Vector3 = new THREE.Vector3()
  private fixedQuaternion: THREE.Quaternion = new THREE.Quaternion()

  // ===== Transition state =====
  private transitionStartPos: THREE.Vector3 = new THREE.Vector3()
  private transitionStartQuat: THREE.Quaternion = new THREE.Quaternion()
  private transitionEndPos: THREE.Vector3 = new THREE.Vector3()
  private transitionEndQuat: THREE.Quaternion = new THREE.Quaternion()
  private transitionDuration: number = 0
  private transitionElapsed: number = 0
  private transitionTargetMode: CameraMode = CameraMode.FOLLOW
  private previousMode: CameraMode = CameraMode.FOLLOW
  private transitionCallback: (() => void) | null = null

  // ===== Free mode state (OrbitControls) =====
  private orbitControls: OrbitControls | null = null
  private freeFollowSpeed: number = 5.0

  // ===== Reusable temp objects to avoid per-frame allocations =====
  private readonly _tempOffset = new THREE.Vector3()
  private readonly _tempDesiredPos = new THREE.Vector3()
  private readonly _tempMatrix = new THREE.Matrix4()
  private readonly _tempUp = new THREE.Vector3(0, 1, 0)
  private readonly _tempQuat = new THREE.Quaternion()

  // ===== Initialization =====

  /**
   * Initialize the camera manager with camera and canvas
   */
  public initialize(
    camera: THREE.PerspectiveCamera,
    canvas: HTMLCanvasElement,
    settings?: Partial<CameraSettings>,
  ): void {
    this.camera = camera
    this.canvas = canvas

    if (settings) {
      this.settings = { ...this.settings, ...settings }
    }

    this.applyCameraSettings()
    this.setupOrbitControls()
  }

  /**
   * Apply camera intrinsic settings (FOV, etc.)
   */
  private applyCameraSettings(): void {
    if (!this.camera) return
    this.camera.fov = this.settings.fov
    this.camera.updateProjectionMatrix()
  }

  /**
   * Setup orbit controls for free camera mode
   */
  private setupOrbitControls(): void {
    if (!this.camera || !this.canvas) return

    this.orbitControls = new OrbitControls(this.camera, this.canvas)
    this.orbitControls.enableDamping = true
    this.orbitControls.dampingFactor = 0.1
    this.orbitControls.enableZoom = true
    this.orbitControls.minDistance = 5
    this.orbitControls.maxDistance = 100
    this.orbitControls.enablePan = true
    this.orbitControls.enabled = false // Disabled by default
  }

  // ===== Target management =====

  /**
   * Set the target for camera to follow
   * Note: This does NOT start the camera. Call start() or use captureCamera/setCameraMode to start.
   */
  public setTarget(target: GameObject): void {
    this.target = target
    // Initialize followTarget to target position (important for calculateFollowPosition)
    // This doesn't affect the camera unless we're in FOLLOW mode
    this.followTarget.copy(target.position)
  }

  /**
   * Start the camera in follow mode.
   * Call this to begin camera updates if not using captureCamera for a title screen.
   */
  public start(): void {
    if (this.isStarted) return
    this.isStarted = true
    this.mode = CameraMode.FOLLOW
    if (this.target) {
      this.followTarget.copy(this.target.position)
      this.updateFollowImmediate()
    }
  }

  /**
   * Set target without snapping followTarget (for smooth transitions)
   */
  public setTargetSmooth(target: GameObject): void {
    this.target = target
    // Don't snap followTarget - let it lerp smoothly
  }

  // ===== Mode switching =====

  /**
   * Get current camera mode
   */
  public getCameraMode(): CameraMode {
    return this.mode
  }

  /**
   * Switch camera mode
   */
  public setCameraMode(mode: CameraMode): void {
    if (this.mode === mode) return

    // Disable orbit controls when leaving FREE mode
    if (this.mode === CameraMode.FREE && this.orbitControls) {
      this.orbitControls.enabled = false
    }

    this.previousMode = this.mode
    this.mode = mode
    this.isStarted = true // Camera is now active

    // Enable orbit controls when entering FREE mode
    if (mode === CameraMode.FREE && this.orbitControls) {
      this.orbitControls.enabled = true
      if (this.target) {
        this.orbitControls.target.copy(this.target.position)
      }
    }

    // When switching to FOLLOW, snap followTarget to target
    if (mode === CameraMode.FOLLOW && this.target) {
      this.followTarget.copy(this.target.position)
      this.updateFollowImmediate()
    }
  }

  /**
   * Toggle between follow and free camera
   */
  public toggleCameraMode(): void {
    const newMode =
      this.mode === CameraMode.FOLLOW ? CameraMode.FREE : CameraMode.FOLLOW
    this.setCameraMode(newMode)
  }

  /**
   * Enable/disable free camera (for external API compatibility)
   * Only switches between FREE and FOLLOW modes - does NOT override FIXED or TRANSITIONING
   */
  public setFreeCameraEnabled(enabled: boolean): void {
    // Don't override FIXED or TRANSITIONING modes
    if (this.mode === CameraMode.FIXED || this.mode === CameraMode.TRANSITIONING) {
      return
    }
    this.setCameraMode(enabled ? CameraMode.FREE : CameraMode.FOLLOW)
  }

  /**
   * Check if free camera is enabled
   */
  public isFreeCameraEnabled(): boolean {
    return this.mode === CameraMode.FREE
  }

  // ===== Capture/Release API =====

  /**
   * Capture camera to a fixed position and rotation.
   * @param position Target position
   * @param quaternion Target rotation
   * @param duration Transition duration in seconds (0 = instant)
   * @param onComplete Optional callback when transition completes
   */
  public captureCamera(
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
    duration: number = 0,
    onComplete?: () => void,
  ): void {
    if (!this.camera) return

    // Store the fixed state
    this.fixedPosition.copy(position)
    this.fixedQuaternion.copy(quaternion)

    // Disable orbit controls if active
    if (this.orbitControls) {
      this.orbitControls.enabled = false
    }

    if (duration <= 0) {
      // Instant capture
      this.previousMode = this.mode
      this.mode = CameraMode.FIXED
      this.isStarted = true // Camera is now active
      this.camera.position.copy(position)
      this.camera.quaternion.copy(quaternion)
      this.camera.updateMatrixWorld(true)
      onComplete?.()
    } else {
      // Animated capture
      this.startTransition(position, quaternion, duration, CameraMode.FIXED, onComplete)
    }
  }

  /**
   * Release camera back to follow mode.
   * @param duration Transition duration in seconds (0 = instant)
   * @param onComplete Optional callback when transition completes
   */
  public releaseCamera(duration: number = 0, onComplete?: () => void): void {
    if (!this.camera || !this.target) return

    if (duration <= 0) {
      // Instant release
      this.mode = CameraMode.FOLLOW
      this.followTarget.copy(this.target.position)
      this.updateFollowImmediate()
      onComplete?.()
    } else {
      // Animated release - transition from current position to follow position
      const endPos = this.calculateFollowPosition()
      const endQuat = this.calculateFollowQuaternion()
      this.startTransition(endPos, endQuat, duration, CameraMode.FOLLOW, onComplete)
    }
  }

  // ===== Legacy API for backwards compatibility =====

  /**
   * Set fixed camera position and rotation (switches to fixed mode if needed)
   * @deprecated Use captureCamera() instead
   */
  public setFixedPositionAndRotation(
    position: THREE.Vector3,
    rotation: THREE.Euler,
  ): void {
    const quaternion = new THREE.Quaternion().setFromEuler(rotation)
    this.captureCamera(position, quaternion, 0)
  }

  /**
   * Set fixed camera position and quaternion (switches to fixed mode if needed)
   * @deprecated Use captureCamera() instead
   */
  public setFixedPositionAndQuaternion(
    position: THREE.Vector3,
    quaternion: THREE.Quaternion,
  ): void {
    this.captureCamera(position, quaternion, 0)
  }

  /**
   * Set fixed camera position looking at target (switches to fixed mode if needed)
   * @deprecated Use captureCameraLookAt() instead
   */
  public setFixedPositionAndLookAt(
    position: THREE.Vector3,
    lookAt: THREE.Vector3,
  ): void {
    this.captureCameraLookAt(position, lookAt, 0)
  }

  /**
   * Capture camera to position looking at a target
   */
  public captureCameraLookAt(
    position: THREE.Vector3,
    lookAt: THREE.Vector3,
    duration: number = 0,
    onComplete?: () => void,
  ): void {
    if (!this.camera) return

    // Calculate quaternion from lookAt
    const tempCamera = this.camera.clone()
    tempCamera.position.copy(position)
    tempCamera.lookAt(lookAt)
    const quaternion = tempCamera.quaternion.clone()

    this.captureCamera(position, quaternion, duration, onComplete)
  }

  /**
   * Transition to fixed camera position and rotation
   * @deprecated Use captureCamera() with duration instead
   */
  public transitionToFixed(
    position: THREE.Vector3,
    rotation: THREE.Euler,
    duration: number,
  ): void {
    const quaternion = new THREE.Quaternion().setFromEuler(rotation)
    this.captureCamera(position, quaternion, duration)
  }

  /**
   * Transition to fixed camera position looking at target
   * @deprecated Use captureCameraLookAt() with duration instead
   */
  public transitionToLookAt(
    position: THREE.Vector3,
    lookAt: THREE.Vector3,
    duration: number,
  ): void {
    this.captureCameraLookAt(position, lookAt, duration)
  }

  // ===== Transition helpers =====

  /**
   * Start a camera transition
   */
  private startTransition(
    endPos: THREE.Vector3,
    endQuat: THREE.Quaternion,
    duration: number,
    targetMode: CameraMode,
    onComplete?: () => void,
  ): void {
    if (!this.camera) return

    this.transitionStartPos.copy(this.camera.position)
    this.transitionStartQuat.copy(this.camera.quaternion)
    this.transitionEndPos.copy(endPos)
    this.transitionEndQuat.copy(endQuat)
    this.transitionDuration = duration
    this.transitionElapsed = 0
    this.transitionTargetMode = targetMode
    this.transitionCallback = onComplete || null
    this.previousMode = this.mode
    this.mode = CameraMode.TRANSITIONING
    this.isStarted = true // Camera is now active
  }

  /**
   * Calculate the spherical offset from a target position (uses reusable temp object)
   */
  private calculateOffset(): THREE.Vector3 {
    const x = this.cameraHeight * Math.sin(this.cameraBeta) * Math.cos(this.cameraAlpha)
    const y = this.cameraHeight * Math.cos(this.cameraBeta)
    const z = this.cameraHeight * Math.sin(this.cameraBeta) * Math.sin(this.cameraAlpha)
    return this._tempOffset.set(x, y, z)
  }

  /**
   * Calculate desired camera position given a look-at target (uses reusable temp object)
   */
  private calculateDesiredPosition(lookAtTarget: THREE.Vector3): THREE.Vector3 {
    const offset = this.calculateOffset()
    return this._tempDesiredPos.set(
      lookAtTarget.x + offset.x,
      lookAtTarget.y + offset.y,
      lookAtTarget.z + offset.z,
    )
  }

  /**
   * Calculate desired rotation for camera at given position looking at target.
   * Uses matrix math instead of cloning camera - much faster.
   */
  private calculateDesiredQuaternion(cameraPos: THREE.Vector3, lookAtTarget: THREE.Vector3): THREE.Quaternion {
    // Use lookAt matrix directly instead of cloning camera
    this._tempMatrix.lookAt(cameraPos, lookAtTarget, this._tempUp)
    return this._tempQuat.setFromRotationMatrix(this._tempMatrix)
  }

  /**
   * Calculate where the follow camera would be positioned (for starting transitions)
   */
  private calculateFollowPosition(): THREE.Vector3 {
    const targetPos = this.target ? this.target.position : this.followTarget
    return this.calculateDesiredPosition(targetPos)
  }

  /**
   * Calculate what rotation the follow camera would have (for starting transitions)
   */
  private calculateFollowQuaternion(): THREE.Quaternion {
    const targetPos = this.target ? this.target.position : this.followTarget
    const cameraPos = this.calculateFollowPosition()
    return this.calculateDesiredQuaternion(cameraPos, targetPos)
  }

  // ===== Update loop =====

  /**
   * Main update - called every frame after all other updates
   */
  public lateUpdate(deltaTime: number): void {
    if (!this.camera || !this.isStarted) return

    switch (this.mode) {
      case CameraMode.FOLLOW:
        this.updateFollow(deltaTime)
        break
      case CameraMode.FIXED:
        // Camera is already positioned, nothing to do
        break
      case CameraMode.TRANSITIONING:
        this.updateTransition(deltaTime)
        break
      case CameraMode.FREE:
        this.updateFree(deltaTime)
        break
    }
  }

  /**
   * Update follow camera - lerps position, keeps fixed rotation relative to target
   */
  private updateFollow(deltaTime: number): void {
    if (!this.target || !this.camera) return

    // Lerp the ghost target toward player position
    const lerpFactor = this.followSpeed * deltaTime
    this.followTarget.lerp(this.target.position, lerpFactor)

    // Calculate desired camera position (offset from ghost target)
    const desiredPos = this.calculateDesiredPosition(this.followTarget)

    // Lerp position toward desired
    this.camera.position.lerp(desiredPos, lerpFactor)
    
    // Calculate rotation as if camera were at desired position looking at target
    // This keeps a consistent rotation regardless of where camera currently is
    const desiredQuat = this.calculateDesiredQuaternion(desiredPos, this.followTarget)
    this.camera.quaternion.copy(desiredQuat)
  }

  /**
   * Immediately update follow camera without lerping
   */
  private updateFollowImmediate(): void {
    if (!this.camera || !this.target) return

    this.followTarget.copy(this.target.position)
    
    const desiredPos = this.calculateDesiredPosition(this.followTarget)
    const desiredQuat = this.calculateDesiredQuaternion(desiredPos, this.followTarget)
    
    this.camera.position.copy(desiredPos)
    this.camera.quaternion.copy(desiredQuat)
  }

  /**
   * Update transition - time-based interpolation between start and end
   */
  private updateTransition(deltaTime: number): void {
    if (!this.camera) return

    this.transitionElapsed += deltaTime
    const t = Math.min(this.transitionElapsed / this.transitionDuration, 1)
    const eased = this.easeInOutCubic(t)

    // When transitioning TO follow mode, dynamically update the end target
    if (this.transitionTargetMode === CameraMode.FOLLOW && this.target) {
      // Update end position/rotation to track where follow camera would be NOW
      this.transitionEndPos.copy(this.calculateFollowPosition())
      this.transitionEndQuat.copy(this.calculateFollowQuaternion())
    }

    // Time-based interpolation from fixed start to current end
    this.camera.position.lerpVectors(
      this.transitionStartPos,
      this.transitionEndPos,
      eased,
    )
    this.camera.quaternion.slerpQuaternions(
      this.transitionStartQuat,
      this.transitionEndQuat,
      eased,
    )

    // Transition complete
    if (t >= 1) {
      this.mode = this.transitionTargetMode

      // If transitioning to FOLLOW, sync followTarget to player position
      if (this.transitionTargetMode === CameraMode.FOLLOW && this.target) {
        this.followTarget.copy(this.target.position)
      }

      // Call completion callback
      if (this.transitionCallback) {
        this.transitionCallback()
        this.transitionCallback = null
      }
    }
  }

  /**
   * Update free camera (orbit controls)
   */
  private updateFree(deltaTime: number): void {
    if (!this.orbitControls || !this.orbitControls.enabled) return

    // Smoothly follow target if set
    if (this.target) {
      const lerpFactor = 1 - Math.exp(-this.freeFollowSpeed * deltaTime)
      this.orbitControls.target.lerp(this.target.position, lerpFactor)
    }

    this.orbitControls.update()
  }

  /**
   * Cubic ease in-out function
   */
  private easeInOutCubic(t: number): number {
    return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
  }

  // ===== Utility methods =====

  /**
   * Check if camera is currently transitioning
   */
  public isTransitioning(): boolean {
    return this.mode === CameraMode.TRANSITIONING
  }

  /**
   * Get debug info about current camera state
   */
  public getDebugCameraState(): { mode: string; position: THREE.Vector3; quaternion: THREE.Quaternion; isStarted: boolean } | null {
    if (!this.camera) return null
    return {
      mode: this.mode,
      position: this.camera.position.clone(),
      quaternion: this.camera.quaternion.clone(),
      isStarted: this.isStarted,
    }
  }

  /**
   * Get the camera object (for parenting effects to it)
   */
  public getCamera(): THREE.PerspectiveCamera | null {
    return this.camera
  }

  /**
   * Get current camera target position (for smooth transitions from other systems)
   */
  public getCameraTarget(): THREE.Vector3 {
    switch (this.mode) {
      case CameraMode.FOLLOW:
      case CameraMode.TRANSITIONING:
        return this.followTarget.clone()
      case CameraMode.FIXED:
        // Return position camera is looking at
        if (this.camera) {
          const direction = new THREE.Vector3(0, 0, -1)
          direction.applyQuaternion(this.camera.quaternion)
          return this.camera.position.clone().add(direction.multiplyScalar(10))
        }
        return new THREE.Vector3()
      case CameraMode.FREE:
        return this.orbitControls
          ? this.orbitControls.target.clone()
          : new THREE.Vector3()
      default:
        return new THREE.Vector3()
    }
  }

  /**
   * Component cleanup
   */
  protected onCleanup(): void {
    if (this.orbitControls) {
      this.orbitControls.dispose()
      this.orbitControls = null
    }
  }
}
