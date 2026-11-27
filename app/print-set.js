import { Mesh, Group, Vector3 } from "three";
import { STLExporter } from "three/addons/exporters/STLExporter.js";
import { measurePlacement } from "./placement";
import { scaleModel } from "./model-scale";

export function describePart(part, orientation, scale, position) {
  const scaled = scaleModel(part.model, scale);
  const placement = measurePlacement(scaled, orientation);
  if (scaled !== part.model) scaled.geometry.dispose();
  return { ...part, orientation, scale, position, placement };
}

export function exportPrintSet(parts, name = `ชุดพิมพ์-${parts.length}-ชิ้น.stl`) {
  const group = new Group();
  for (const part of parts) {
    const mesh = new Mesh(part.model.geometry, null);
    if (part.model.winding < 0) {
      const indices = [];
      for (let i=0;i<mesh.geometry.attributes.position.count;i+=3) indices.push(i,i+2,i+1);
      mesh.geometry = mesh.geometry.clone().setIndex(indices);
    }
    mesh.scale.fromArray(part.scale);
    mesh.quaternion.copy(part.orientation);
    mesh.position.copy(part.placement.offset).add(new Vector3(...part.position));
    group.add(mesh);
  }
  group.updateMatrixWorld(true);
  const data = new STLExporter().parse(group,{binary:true});
  group.children.forEach((mesh,i) => { if (mesh.geometry !== parts[i].model.geometry) mesh.geometry.dispose(); });
  return new File([data.buffer], name, {type:"model/stl"});
}
