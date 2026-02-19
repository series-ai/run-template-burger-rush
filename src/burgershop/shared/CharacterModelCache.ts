import * as THREE from "three"
import { FBXLoader } from "three/examples/jsm/loaders/FBXLoader.js"
import { SkeletonUtils } from "three-stdlib"

export class CharacterModelCache {
  private static loader = new FBXLoader()
  private static originals: Map<string, THREE.Object3D> = new Map()
  private static loading: Map<string, Promise<THREE.Object3D>> = new Map()

  public static isLoaded(path: string): boolean {
    return this.originals.has(path)
  }

  public static async preload(path: string): Promise<THREE.Object3D> {
    if (this.originals.has(path)) {
      return this.originals.get(path)!
    }
    if (this.loading.has(path)) {
      return this.loading.get(path)!
    }
    const p = this.loader.loadAsync(path).then((object) => {
      this.originals.set(path, object)
      this.loading.delete(path)
      return object
    }).catch((err) => {
      this.loading.delete(path)
      throw err
    })
    this.loading.set(path, p)
    return p
  }

  public static getClone(path: string): THREE.Object3D | null {
    const original = this.originals.get(path)
    if (!original) return null
    // Deep clone skinned meshes/skeletons safely
    const clone = SkeletonUtils.clone(original)
    return clone as THREE.Object3D
  }
}
