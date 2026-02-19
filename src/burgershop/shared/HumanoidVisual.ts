import * as THREE from "three"
import { Component } from "@series-inc/rundot-3d-engine"
import { MaterialUtils } from "@series-inc/rundot-3d-engine/systems"
import { CharacterModelCache } from "./CharacterModelCache"

export type HumanoidVisualOptions = {
  fbxPath?: string
  positionOffset?: THREE.Vector3
  onBeforeAttach?: (object: THREE.Object3D) => void
  onLoaded?: (object: THREE.Object3D) => void | Promise<void>
  onError?: (error: unknown) => void
}

/**
 * Loads and attaches a humanoid FBX model to the GameObject.
 * Calls optional hooks for material customization and post-load setup.
 */
export class HumanoidVisual extends Component {
  private readonly options: HumanoidVisualOptions
  private characterModel: THREE.Object3D | null = null

  constructor(options?: HumanoidVisualOptions) {
    super()
    this.options = options ?? {}
  }

  public getObject3D(): THREE.Object3D | null {
    return this.characterModel
  }

  protected onCreate(): void {
    const fbxPath =
      this.options.fbxPath ?? "stowkit://Character_Employee_01"
    CharacterModelCache.preload(fbxPath)
      .then(async () => {
        const object = CharacterModelCache.getClone(fbxPath)
        if (!object) {
          this.options.onError?.(
            new Error("CharacterModelCache returned null clone"),
          )
          return
        }
        this.characterModel = object

        // Shadows for all meshes
        this.characterModel.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) {
            ;(child as THREE.Mesh).castShadow = true
            ;(child as THREE.Mesh).receiveShadow = true
          }
        })

        // Ensure per-instance material copies so customization doesn't affect other instances
        this.characterModel.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh
            if (Array.isArray(mesh.material)) {
              mesh.material = mesh.material.map((m: THREE.Material) => {
                const cloned = m.clone()
                ;(cloned as any).needsUpdate = true
                return cloned
              })
            } else if (mesh.material) {
              const cloned = (mesh.material as THREE.Material).clone()
              ;(cloned as any).needsUpdate = true
              mesh.material = cloned
            }
          }
        })

        // Convert all materials to toon with gradient ramp for a cohesive look
        this.characterModel.traverse((child: THREE.Object3D) => {
          if ((child as THREE.Mesh).isMesh) {
            const mesh = child as THREE.Mesh
            if (Array.isArray(mesh.material)) {
              mesh.material = mesh.material.map((m: THREE.Material) =>
                MaterialUtils.convertToToon(
                  m,
                  "assets/cozy_game_general/threeTone.jpg",
                ),
              )
            } else if (mesh.material) {
              mesh.material = MaterialUtils.convertToToon(
                mesh.material as THREE.Material,
                "assets/cozy_game_general/threeTone.jpg",
              )
            }
          }
        })

        // Allow consumer to customize materials, colors, textures, etc
        if (this.options.onBeforeAttach) {
          this.options.onBeforeAttach(this.characterModel)
        }

        // Position offset (e.g., players use -1.5 Y)
        const offset = this.options.positionOffset ?? new THREE.Vector3(0, 0, 0)
        this.characterModel.position.add(offset)

        this.gameObject.add(this.characterModel)

        // Consumer can wire up animation controller, etc
        if (this.options.onLoaded) {
          await this.options.onLoaded(this.characterModel)
        }
      })
      .catch((error) => {
        if (this.options.onError) {
          this.options.onError(error)
        } else {
          console.error("Error loading humanoid FBX:", error)
        }
      })
  }
}
