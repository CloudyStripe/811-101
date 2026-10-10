import { BufferGeometry, InstancedMesh, Texture, type Material, type Object3D } from 'three';

function disposeMaterial(material: Material): void {
  for (const value of Object.values(material)) {
    if (value instanceof Texture) value.dispose();
  }
  material.dispose();
}

/** Frees every geometry, material, texture and instance buffer under `root`. */
export function disposeObject(root: Object3D): void {
  root.traverse((object) => {
    const { geometry, material } = object as {
      geometry?: unknown;
      material?: Material | Material[];
    };
    if (geometry instanceof BufferGeometry) geometry.dispose();
    if (Array.isArray(material)) material.forEach(disposeMaterial);
    else if (material) disposeMaterial(material);
    if (object instanceof InstancedMesh) object.dispose();
  });
}
