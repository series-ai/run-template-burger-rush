export {
    Prefab,
    PrefabNode,
    PrefabInstance,
    PrefabCollection,
    PrefabLoader,
    type PrefabJSON,
    type PrefabNodeJSON,
    type PrefabCollectionJSON,
    type PrefabComponentJSON,
    type TransformComponentJSON,
} from "@series-inc/rundot-3d-engine/systems"

export interface BoxComponentJSON {
    type: "box"
    isCollider?: boolean
    size: number[]
    offset: number[]
    [key: string]: unknown
}
