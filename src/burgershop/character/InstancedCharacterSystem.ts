import * as THREE from "three"

/**
 * Instanced character rendering system
 * Uses InstancedMesh for character body parts with per-instance colors
 * NOTE: This is experimental - skinned meshes (with bones) can't be directly instanced
 * but we can instance static LOD versions for distant characters
 */
export class InstancedCharacterSystem {
  private static instance: InstancedCharacterSystem | null = null
  
  // Maximum number of characters we can instance
  private static readonly MAX_INSTANCES = 100
  
  // Instanced meshes for each body part
  private bodyMesh: THREE.InstancedMesh | null = null
  private headMesh: THREE.InstancedMesh | null = null
  
  // Instance data
  private instanceCount: number = 0
  private instanceColors: Float32Array
  private instanceMatrices: Float32Array
  
  // Mapping of instance index to character
  private characterToInstance: Map<string, number> = new Map()
  private instanceToCharacter: Map<number, string> = new Map()
  
  private constructor() {
    // Pre-allocate arrays for max instances
    this.instanceColors = new Float32Array(InstancedCharacterSystem.MAX_INSTANCES * 3)
    this.instanceMatrices = new Float32Array(InstancedCharacterSystem.MAX_INSTANCES * 16)
  }
  
  public static getInstance(): InstancedCharacterSystem {
    if (!InstancedCharacterSystem.instance) {
      InstancedCharacterSystem.instance = new InstancedCharacterSystem()
    }
    return InstancedCharacterSystem.instance
  }
  
  /**
   * Initialize instanced meshes from a template character
   * This should be called once with the base character geometry
   */
  public initializeFromTemplate(templateModel: THREE.Object3D): void {
    // Extract geometries from the template
    let bodyGeometry: THREE.BufferGeometry | null = null
    let headGeometry: THREE.BufferGeometry | null = null
    
    templateModel.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        // Try to identify body parts by name
        const name = child.name.toLowerCase()
        if (name.includes('body') && !bodyGeometry) {
          bodyGeometry = child.geometry
        } else if (name.includes('head') && !headGeometry) {
          headGeometry = child.geometry
        }
      }
    })
    
    if (!bodyGeometry || !headGeometry) {
      console.warn("InstancedCharacterSystem: Could not extract geometries from template")
      return
    }
    
    // Create instanced meshes
    const material = new THREE.MeshLambertMaterial({
      vertexColors: true // Use per-instance colors
    })
    
    this.bodyMesh = new THREE.InstancedMesh(
      bodyGeometry,
      material,
      InstancedCharacterSystem.MAX_INSTANCES
    )
    
    this.headMesh = new THREE.InstancedMesh(
      headGeometry,
      material,
      InstancedCharacterSystem.MAX_INSTANCES
    )
    
    // Set up instance attributes
    this.setupInstanceAttributes()
    
    console.log("InstancedCharacterSystem: Initialized with template")
  }
  
  /**
   * Set up per-instance color attributes
   */
  private setupInstanceAttributes(): void {
    if (!this.bodyMesh || !this.headMesh) return
    
    // Add color attribute to instanced meshes
    const colorAttribute = new THREE.InstancedBufferAttribute(
      this.instanceColors,
      3
    )
    
    this.bodyMesh.geometry.setAttribute('instanceColor', colorAttribute)
    this.headMesh.geometry.setAttribute('instanceColor', colorAttribute)
  }
  
  /**
   * Add a character to the instanced system
   * Returns the instance index or -1 if full
   */
  public addCharacter(
    characterId: string,
    position: THREE.Vector3,
    rotation: THREE.Euler,
    color: THREE.Color
  ): number {
    if (this.instanceCount >= InstancedCharacterSystem.MAX_INSTANCES) {
      console.warn("InstancedCharacterSystem: Max instances reached")
      return -1
    }
    
    const index = this.instanceCount
    
    // Store mapping
    this.characterToInstance.set(characterId, index)
    this.instanceToCharacter.set(index, characterId)
    
    // Set transform
    this.updateCharacterTransform(index, position, rotation)
    
    // Set color
    this.updateCharacterColor(index, color)
    
    this.instanceCount++
    
    // Update instance count on meshes
    if (this.bodyMesh) this.bodyMesh.count = this.instanceCount
    if (this.headMesh) this.headMesh.count = this.instanceCount
    
    return index
  }
  
  /**
   * Update character transform
   */
  public updateCharacterTransform(
    index: number,
    position: THREE.Vector3,
    rotation: THREE.Euler
  ): void {
    if (index < 0 || index >= this.instanceCount) return
    
    const matrix = new THREE.Matrix4()
    matrix.makeRotationFromEuler(rotation)
    matrix.setPosition(position)
    
    // Update both meshes
    if (this.bodyMesh) {
      this.bodyMesh.setMatrixAt(index, matrix)
      this.bodyMesh.instanceMatrix.needsUpdate = true
    }
    
    if (this.headMesh) {
      this.headMesh.setMatrixAt(index, matrix)
      this.headMesh.instanceMatrix.needsUpdate = true
    }
  }
  
  /**
   * Update character color
   */
  public updateCharacterColor(index: number, color: THREE.Color): void {
    if (index < 0 || index >= this.instanceCount) return
    
    // Update color in array
    const offset = index * 3
    this.instanceColors[offset] = color.r
    this.instanceColors[offset + 1] = color.g
    this.instanceColors[offset + 2] = color.b
    
    // Mark as needing update
    if (this.bodyMesh) {
      const colorAttr = this.bodyMesh.geometry.getAttribute('instanceColor') as THREE.InstancedBufferAttribute
      colorAttr.needsUpdate = true
    }
    
    if (this.headMesh) {
      const colorAttr = this.headMesh.geometry.getAttribute('instanceColor') as THREE.InstancedBufferAttribute
      colorAttr.needsUpdate = true
    }
  }
  
  /**
   * Remove a character from the instanced system
   */
  public removeCharacter(characterId: string): void {
    const index = this.characterToInstance.get(characterId)
    if (index === undefined) return
    
    // Swap with last instance
    if (index < this.instanceCount - 1) {
      const lastIndex = this.instanceCount - 1
      const lastCharacterId = this.instanceToCharacter.get(lastIndex)!
      
      // Copy last instance data to this slot
      // (Transform and color copying would go here)
      
      // Update mappings
      this.characterToInstance.set(lastCharacterId, index)
      this.instanceToCharacter.set(index, lastCharacterId)
    }
    
    // Remove mappings
    this.characterToInstance.delete(characterId)
    this.instanceToCharacter.delete(this.instanceCount - 1)
    
    this.instanceCount--
    
    // Update instance count on meshes
    if (this.bodyMesh) this.bodyMesh.count = this.instanceCount
    if (this.headMesh) this.headMesh.count = this.instanceCount
  }
  
  /**
   * Get the instanced meshes to add to the scene
   */
  public getMeshes(): THREE.InstancedMesh[] {
    const meshes: THREE.InstancedMesh[] = []
    if (this.bodyMesh) meshes.push(this.bodyMesh)
    if (this.headMesh) meshes.push(this.headMesh)
    return meshes
  }
  
  /**
   * Get statistics
   */
  public getStats(): { instances: number; maxInstances: number } {
    return {
      instances: this.instanceCount,
      maxInstances: InstancedCharacterSystem.MAX_INSTANCES
    }
  }
}
