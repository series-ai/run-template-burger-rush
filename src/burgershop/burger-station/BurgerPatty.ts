import { Component, GameObject, InstancedRenderer } from "@series-inc/rundot-3d-engine"
import { PrefabLoader, StowKitSystem, ParticleSystemPrefabComponent } from "@series-inc/rundot-3d-engine/systems"

/**
 * Burger patty component - displays instanced patty mesh and smoke particles.
 * Used as a visual effect for burger cooking on the grill.
 */
export class BurgerPatty extends Component {
    public static readonly BATCH_KEY: string = "patty"

    private meshComponent: InstancedRenderer | null = null
    private smokeHolder: GameObject | null = null
    private smokeParticleComponent: ParticleSystemPrefabComponent | undefined = undefined

    /**
     * Called when component is attached to GameObject
     */
    protected onCreate(): void {
        // Setup instanced patty mesh
        this.gameObject.scale.setScalar(1.0)
        this.meshComponent = new InstancedRenderer(BurgerPatty.BATCH_KEY)
        this.gameObject.addComponent(this.meshComponent)

        // Load smoke particle prefab
        const prefabCollection = StowKitSystem.getInstance().getPrefabCollection()
        const smokePrefab = prefabCollection.getPrefabByName("pfx_burger_smoke")
        if (smokePrefab) {
            this.smokeHolder = new GameObject("BurgerSmoke")
            this.smokeHolder.position.set(0, 0.12, 0)
            this.gameObject.add(this.smokeHolder)

            const instance = PrefabLoader.instantiatePrefab(smokePrefab, this.smokeHolder)
            this.smokeParticleComponent = instance.gameObject.getComponent(ParticleSystemPrefabComponent)
            if (this.smokeParticleComponent) {
                this.smokeParticleComponent.play()
            }
        }
    }

    /**
     * Called when component is enabled - restart smoke particles
     */
    public onEnabled(): void {
        if (this.smokeParticleComponent) {
            this.smokeParticleComponent.play()
        }
    }

    /**
     * Called when component is disabled - stop smoke particles
     */
    public onDisabled(): void {
        if (this.smokeParticleComponent) {
            this.smokeParticleComponent.stop()
        }
    }

    protected onCleanup(): void {
        if (this.smokeHolder) {
            this.gameObject.remove(this.smokeHolder)
            this.smokeHolder = null
        }
        this.smokeParticleComponent = undefined
    }
}
