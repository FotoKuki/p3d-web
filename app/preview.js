"use client";

import { useEffect, useRef, useState } from "react";
import {
  AmbientLight, Box3, BoxGeometry, BufferGeometry, CanvasTexture, DirectionalLight, DoubleSide, EdgesGeometry, Group,
  HemisphereLight, InstancedMesh, LineBasicMaterial, LineSegments, Matrix4, Mesh, MeshBasicMaterial, MOUSE,
  MeshStandardMaterial, PerspectiveCamera, Raycaster, Scene, Sprite, SpriteMaterial, Vector2, Vector3, WebGLRenderer,
} from "three";
import { OrbitControls } from "three/addons/controls/OrbitControls.js";
import { TransformControls } from "three/addons/controls/TransformControls.js";
import { plateOffset } from "./plate-layout";
import { settings } from "./pricing";
import { buildFaceHighlight, getFacePlane, originalOrientation } from "./placement";

const plateOrigin = new Vector3();

function plateLabel(index, active) {
  const canvas = document.createElement("canvas");
  canvas.width = 128;
  canvas.height = 64;
  const context = canvas.getContext("2d");
  if (!context) return null;
  context.fillStyle = active ? "#b91c1c" : "#33343a";
  context.fillRect(14, 8, 100, 48);
  context.fillStyle = "#fff";
  context.font = "600 34px system-ui";
  context.textAlign = "center";
  context.textBaseline = "middle";
  context.fillText(String(index + 1).padStart(2, "0"), 64, 33);
  const sprite = new Sprite(new SpriteMaterial({ map: new CanvasTexture(canvas), depthWrite: false }));
  sprite.scale.set(48, 24, 1);
  const [width, depth] = settings.buildSize;
  sprite.position.set(width / 2 - 20, depth / 2 - 13, 6);
  return sprite;
}

function createPlate() {
  const [width, depth] = settings.buildSize;
  const group = new Group();
  const geometry = new BoxGeometry(width, depth, 2);
  const material = new MeshBasicMaterial({ color: 0x51565c, transparent: true, opacity: 0.3, depthWrite: false });
  const bed = new Mesh(geometry, material);
  bed.position.z = -1.13;
  group.add(bed);

  const border = new LineSegments(new EdgesGeometry(geometry), new LineBasicMaterial({ color: 0x9a9fa5, transparent: true, opacity: 0.42 }));
  border.position.z = bed.position.z;
  group.add(border);

  const halfWidth = width / 2, halfDepth = depth / 2;
  const grid = [], major = [];
  for (let x = Math.ceil(-halfWidth / 10) * 10; x < halfWidth; x += 10) {
    (x % 50 === 0 ? major : grid).push(new Vector3(x, -halfDepth, -0.1), new Vector3(x, halfDepth, -0.1));
  }
  for (let y = Math.ceil(-halfDepth / 10) * 10; y < halfDepth; y += 10) {
    (y % 50 === 0 ? major : grid).push(new Vector3(-halfWidth, y, -0.1), new Vector3(halfWidth, y, -0.1));
  }
  for (const [points, opacity] of [[grid, 0.22], [major, 0.36]]) {
    const lines = new BufferGeometry().setFromPoints(points);
    group.add(new LineSegments(lines, new LineBasicMaterial({ color: 0x9a9fa5, transparent: true, opacity })));
  }
  return { group, material };
}

function makeCopies(geometry, material, placement, orientation, offsets) {
  const copies = new InstancedMesh(geometry, material, offsets.length);
  updateCopyTransforms(copies, placement, orientation, offsets);
  return copies;
}

function updateCopyTransforms(copies, placement, orientation, offsets) {
  const matrix = new Matrix4().makeRotationFromQuaternion(orientation);
  const { x, y, z } = placement.offset;
  offsets.forEach(([dx, dy], index) => {
    matrix.setPosition(x + dx, y + dy, z);
    copies.setMatrixAt(index, matrix);
  });
  copies.instanceMatrix.needsUpdate = true;
}

const cameraDirections = {
  below: [0.55, -0.92, -0.78],
  front: [0, -1, 0],
  top: [0, -0.0001, 1],
  right: [1, 0, 0],
  support: [0.64, -0.95, 0.54],
};

function positionCamera(state) {
  const { camera, controls, overview, pickable, part, otherParts } = state;
  const direction = new Vector3(...(cameraDirections[overview.mode] ?? [1, -1, 1])).normalize();
  let distance = overview.diagonal * 1.65 * Math.max(1, 1.15 / camera.aspect);
  controls.target.set(overview.centerX ?? 0, overview.centerY ?? 0, overview.targetHeight ?? 0);

  if (overview.mode === "fit" && pickable) {
    pickable.computeBoundingBox();
    const bounds = new Box3();
    bounds.expandByObject(pickable);
    bounds.expandByObject(otherParts);
    if (!bounds.isEmpty()) {
      bounds.getCenter(controls.target);
      const vertical = camera.fov * Math.PI / 360;
      const horizontal = Math.atan(Math.tan(vertical) * camera.aspect);
      const radius = bounds.getSize(new Vector3()).length() / 2;
      distance = Math.max(controls.minDistance, radius * 1.2 / Math.sin(Math.min(vertical, horizontal)));
    }
  }
  camera.position.copy(controls.target).addScaledVector(direction, distance);
  controls.update();
}

export default function Preview({ plateCount = 1, activePlate = 0, others, onSelectPart, model, placement, orientation, offsets, overhang, treeSupport, color, view, reset, faceMode, onLayFace, rotationMode, onRotate, moveMode, position, clampMove, onMove, onUnavailable }) {
  const host = useRef(null);
  const rendererState = useRef(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const mount = host.current;
    let renderer;
    try {
      renderer = new WebGLRenderer({ alpha: true, antialias: true });
    } catch {
      onUnavailable();
      return;
    }
    const scene = new Scene();
    const camera = new PerspectiveCamera(42, 1, 0.5, 50000);
    camera.up.set(0, 0, 1);
    const part = new Group(), otherParts = new Group(), supports = new Group(), pivot = new Group();
    const plate = createPlate();
    scene.add(part, otherParts, supports, pivot, plate.group, new AmbientLight(0xadcfff, 0.55), new HemisphereLight(0xe4f5ff, 0x153f62, 2.1));
    const key = new DirectionalLight(0xffffff, 2.35);
    key.position.set(-150, -100, 250);
    const rim = new DirectionalLight(0x4fd3ff, 2.2);
    rim.position.set(120, 250, 75);
    scene.add(key, rim);

    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    mount.append(renderer.domElement);
    const rotation = new TransformControls(camera, renderer.domElement);
    // Route ring gestures separately so right-button panning and touch zoom still go to OrbitControls.
    rotation.disconnect();
    rotation.setMode("rotate");
    rotation.setSpace("world");
    rotation.setSize(0.95);
    rotation.setColors(0xff617a, 0x62e892, 0x5a9bff, 0xffe18a);
    rotation.detach();
    scene.add(rotation.getHelper());

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.mouseButtons = { LEFT: MOUSE.ROTATE, MIDDLE: MOUSE.DOLLY, RIGHT: MOUSE.PAN };
    controls.minDistance = 12;
    controls.maxDistance = 20000;
    controls.enablePan = true;
    const render = () => renderer.render(scene, camera);
    const state = { scene, part, otherParts, supports, pivot, rotation, plate, camera, controls, render, overview: { mode: "default", diagonal: Math.hypot(...settings.buildSize.slice(0, 2)) } };
    rendererState.current = state;
    const resize = () => {
      const { clientWidth: width, clientHeight: height } = mount;
      if (!width || !height) return;
      if (state.width === width && state.height === height) return;
      state.width = width;
      state.height = height;
      renderer.setSize(width, height);
      camera.aspect = width / height;
      camera.updateProjectionMatrix();
      positionCamera(state);
      render();
    };
    const observer = new ResizeObserver(resize);
    observer.observe(mount);
    controls.addEventListener("change", render);
    resize();
    setReady(true);
    return () => {
      rendererState.current = null;
      observer.disconnect();
      controls.dispose();
      rotation.dispose();
      plate.group.traverse((child) => {
        child.geometry?.dispose();
        child.material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    };
  }, [onUnavailable]);

  useEffect(() => {
    const state = rendererState.current;
    if (!state || !model || !placement || !offsets.length) return;
    const material = new MeshStandardMaterial({ color, roughness: 0.49, metalness: 0.24, side: DoubleSide });
    const copies = makeCopies(model.geometry, material, placement, orientation, offsets);
    state.part.add(copies);
    state.pickable = copies;
    const interfaceMaterial = overhang && new MeshBasicMaterial({
      color: 0xffa11b, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -2,
    });
    const interfaceCopies = overhang && makeCopies(overhang, interfaceMaterial, placement, orientation, offsets);
    if (interfaceCopies) state.supports.add(interfaceCopies);
    state.render();
    return () => {
      state.pickable = null;
      state.part.remove(copies);
      copies.dispose();
      material.dispose();
      if (interfaceCopies) {
        state.supports.remove(interfaceCopies);
        interfaceCopies.dispose();
        interfaceMaterial.dispose();
      }
    };
  }, [ready, model, placement, orientation, offsets, overhang, color]);


  const selectRef = useRef(onSelectPart);
  selectRef.current = onSelectPart;
  useEffect(() => {
    const state = rendererState.current;
    if (!state || !others?.length) return;
    const material = new MeshStandardMaterial({color:0x8196a8, side:DoubleSide});
    const meshes = others.map(part => {
      const mesh = new Mesh(part.model.geometry, material);
      mesh.scale.fromArray(part.scale);
      mesh.quaternion.copy(part.orientation);
      const [x, y] = plateOffset(part.plate ?? 0, settings.buildSize);
      mesh.position.copy(part.placement.offset).add(new Vector3(...part.position));
      mesh.position.x += x;
      mesh.position.y += y;
      mesh.userData.file = part.file;
      state.otherParts.add(mesh);
      return mesh;
    });
    state.render();
    const canvas = state.controls.domElement;
    let start;
    function down(e) { start = e.button === 0 ? [e.clientX,e.clientY] : null; }
    function up(e) {
      if (!start || Math.hypot(e.clientX-start[0],e.clientY-start[1])>5 || state.rotation.dragging) return;
      const rect = canvas.getBoundingClientRect();
      const ray = new Raycaster();
      ray.setFromCamera(new Vector2(2*(e.clientX-rect.left)/rect.width-1,1-2*(e.clientY-rect.top)/rect.height),state.camera);
      const hit = ray.intersectObjects(state.pickable ? [...meshes,state.pickable] : meshes,false)[0];
      if (hit?.object.userData.file) {
        e.stopImmediatePropagation();
        selectRef.current(hit.object.userData.file);
      }
    }
    canvas.addEventListener("pointerdown",down);
    canvas.addEventListener("pointerup",up,true);
    return () => {
      canvas.removeEventListener("pointerdown",down);
      canvas.removeEventListener("pointerup",up,true);
      state.otherParts.remove(...meshes);
      material.dispose();
      state.render();
    };
  },[ready,others]);

  useEffect(() => {
    const state = rendererState.current;
    if (!state || !treeSupport || !offsets.length) return;
    const material = new MeshStandardMaterial({ color: 0x72e4ab, roughness: 0.62 });
    const trees = makeCopies(treeSupport, material, { offset: plateOrigin }, originalOrientation, offsets);
    state.supports.add(trees);
    state.render();
    return () => {
      state.supports.remove(trees);
      trees.dispose();
      material.dispose();
      if (rendererState.current === state) state.render();
    };
  }, [ready, treeSupport, offsets]);

  useEffect(() => {
    const state = rendererState.current;
    if (!state?.pickable || !faceMode) return;
    const { pickable } = state;
    const canvas = state.controls.domElement;
    const raycaster = new Raycaster();
    const pointer = new Vector2();
    const highlightMaterial = new MeshBasicMaterial({
      color: 0xfcc0fa, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -4, polygonOffsetUnits: -4,
    });
    let highlight = null;
    let dragStart = null;
    let frameId = 0;
    let hoverEvent = null;

    function pick(event) {
      const bounds = canvas.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
      raycaster.setFromCamera(pointer, state.camera);
      return raycaster.intersectObject(pickable, false)[0];
    }

    function clearFace() {
      if (!highlight) return;
      state.part.remove(highlight.mesh);
      highlight.mesh.geometry.dispose();
      highlight = null;
      state.render();
    }

    function hover(event) {
      hoverEvent = event;
      if (frameId || dragStart) return;
      frameId = requestAnimationFrame(() => {
        frameId = 0;
        if (dragStart) return;
        const hit = pick(hoverEvent);
        if (!hit?.face) return clearFace();
        if (highlight?.instanceId === hit.instanceId && highlight?.faceIndex === hit.faceIndex) return;
        const plane = getFacePlane(model, hit.face);
        if (highlight?.instanceId === hit.instanceId && highlight.plane.normal.dot(plane.normal) > 0.99999
          && Math.abs(highlight.plane.distance - plane.distance) < 0.025) {
          highlight.faceIndex = hit.faceIndex;
          return;
        }
        clearFace();
        const mesh = new Mesh(buildFaceHighlight(model, plane), highlightMaterial);
        mesh.matrixAutoUpdate = false;
        mesh.matrixWorldNeedsUpdate = true;
        pickable.getMatrixAt(hit.instanceId, mesh.matrix);
        state.part.add(mesh);
        highlight = { mesh, plane, instanceId: hit.instanceId, faceIndex: hit.faceIndex };
        state.render();
      });
    }

    function press(event) {
      if (event.button === 0) dragStart = { x: event.clientX, y: event.clientY, id: event.pointerId };
    }

    function release(event) {
      const start = dragStart;
      dragStart = null;
      if (!start || start.id !== event.pointerId || Math.hypot(event.clientX - start.x, event.clientY - start.y) > 6) return;
      const hit = pick(event);
      if (hit?.face) onLayFace(getFacePlane(model, hit.face));
    }

    function leave() {
      cancelAnimationFrame(frameId);
      frameId = 0;
      clearFace();
    }

    function cancel() {
      dragStart = null;
      leave();
    }

    canvas.addEventListener("pointermove", hover);
    canvas.addEventListener("pointerleave", leave);
    canvas.addEventListener("pointerdown", press);
    canvas.addEventListener("pointerup", release);
    canvas.addEventListener("pointercancel", cancel);
    return () => {
      canvas.removeEventListener("pointermove", hover);
      canvas.removeEventListener("pointerleave", leave);
      canvas.removeEventListener("pointerdown", press);
      canvas.removeEventListener("pointerup", release);
      canvas.removeEventListener("pointercancel", cancel);
      cancelAnimationFrame(frameId);
      if (highlight) {
        state.part.remove(highlight.mesh);
        highlight.mesh.geometry.dispose();
      }
      highlightMaterial.dispose();
      if (rendererState.current === state) state.render();
    };
  }, [ready, faceMode, model, placement, orientation, offsets, overhang, color, onLayFace]);


  useEffect(() => {
    const state = rendererState.current;
    if ((!rotationMode && !moveMode) || !state?.pickable) return;
    const { controls, rotation, pivot, pickable, part, supports } = state;
    const canvas = controls.domElement;
    const [dx, dy] = offsets[0];
    const start = placement.offset.clone().add(new Vector3(dx, dy, 0));
    const committed = new Vector3().fromArray(position);
    const origin = start.clone().sub(committed);
    pivot.position.copy(start);
    pivot.quaternion.copy(orientation);
    rotation.setMode(moveMode ? "translate" : "rotate");
    rotation.showXY = rotation.showXZ = rotation.showYZ = !moveMode;
    if (moveMode) {
      const min = clampMove([-Infinity, -Infinity, -Infinity]);
      const max = clampMove([Infinity, Infinity, Infinity]);
      rotation.minX = origin.x + min[0];
      rotation.minY = origin.y + min[1];
      rotation.minZ = origin.z + min[2];
      rotation.maxX = origin.x + max[0];
      rotation.maxY = origin.y + max[1];
      rotation.maxZ = origin.z + max[2];
    }
    rotation.attach(pivot);

    const pointer = new Vector2();
    let dragPointer = null;
    const readPointer = (event, button) => {
      const bounds = canvas.getBoundingClientRect();
      pointer.set((event.clientX - bounds.left) / bounds.width * 2 - 1, 1 - (event.clientY - bounds.top) / bounds.height * 2);
      pointer.button = button;
      return pointer;
    };

    function renderTransform() {
      if (dragPointer !== null) {
        if (moveMode) part.position.copy(pivot.position).sub(start);
        else updateCopyTransforms(pickable, placement, pivot.quaternion, offsets);
      }
      state.render();
    }

    function press(event) {
      if (event.button !== 0 || dragPointer !== null) return;
      const point = readPointer(event, 0);
      rotation.pointerHover(point);
      if (!rotation.axis) return;
      rotation.pointerDown(point);
      if (!rotation.dragging) return;
      event.stopImmediatePropagation();
      canvas.setPointerCapture(event.pointerId);
      dragPointer = event.pointerId;
      supports.visible = false;
      pickable.frustumCulled = false;
      renderTransform();
    }

    function move(event) {
      if (dragPointer === event.pointerId) {
        event.stopImmediatePropagation();
        rotation.pointerMove(readPointer(event, -1));
      } else if (dragPointer === null && event.buttons === 0 && event.pointerType !== "touch") {
        rotation.pointerHover(readPointer(event, -1));
      }
    }

    function end(event, commit) {
      if (event.pointerId !== dragPointer) return;
      event.stopImmediatePropagation();
      dragPointer = null;
      if (canvas.hasPointerCapture(event.pointerId)) canvas.releasePointerCapture(event.pointerId);
      rotation.pointerUp(null);
      supports.visible = true;
      pickable.frustumCulled = true;
      const next = pivot.quaternion.clone().normalize();
      if (commit && moveMode && pivot.position.distanceToSquared(start) > 0.000001) {
        onMove(pivot.position.clone().sub(origin).toArray());
      } else if (commit && !moveMode && next.angleTo(orientation) > 0.000001) onRotate(next);
      else {
        part.position.set(0, 0, 0);
        pivot.position.copy(start);
        pivot.quaternion.copy(orientation);
        updateCopyTransforms(pickable, placement, orientation, offsets);
      }
      state.render();
    }

    function release(event) { end(event, true); }
    function cancel(event) { end(event, false); }

    canvas.addEventListener("pointerdown", press, true);
    canvas.addEventListener("pointermove", move, true);
    canvas.addEventListener("pointerup", release, true);
    canvas.addEventListener("pointercancel", cancel, true);
    canvas.addEventListener("lostpointercapture", cancel, true);
    rotation.addEventListener("change", renderTransform);
    state.render();

    return () => {
      canvas.removeEventListener("pointerdown", press, true);
      canvas.removeEventListener("pointermove", move, true);
      canvas.removeEventListener("pointerup", release, true);
      canvas.removeEventListener("pointercancel", cancel, true);
      canvas.removeEventListener("lostpointercapture", cancel, true);
      rotation.removeEventListener("change", renderTransform);
      if (dragPointer !== null) {
        if (canvas.hasPointerCapture(dragPointer)) canvas.releasePointerCapture(dragPointer);
        rotation.pointerUp(null);
        updateCopyTransforms(pickable, placement, orientation, offsets);
      }
      part.position.set(0, 0, 0);
      supports.visible = true;
      pickable.frustumCulled = true;
      rotation.detach();
      if (rendererState.current === state) state.render();
    };
  }, [ready, rotationMode, moveMode, position, clampMove, onMove, model, placement, orientation, offsets, overhang, color, onRotate]);

  useEffect(() => {
    const state = rendererState.current;
    if (!state) return;
    const extra = Array.from({ length: plateCount - 1 }, (_, index) => {
      const plate = createPlate();
      const [x, y] = plateOffset(index + 1, settings.buildSize);
      plate.group.position.set(x, y, 0);
      plate.material.opacity = index + 1 === activePlate ? 0.43 : 0.22;
      state.scene.add(plate.group);
      return plate;
    });
    const labels = plateCount > 1 ? [state.plate, ...extra].map((plate, index) => {
      const label = plateLabel(index, index === activePlate);
      if (label) plate.group.add(label);
      return label;
    }) : [];
    state.render();
    return () => {
      for (const label of labels) {
        if (!label) continue;
        label.removeFromParent();
        label.material.map.dispose();
        label.material.dispose();
      }
      for (const plate of extra) {
        state.scene.remove(plate.group);
        plate.group.traverse(child => {
          child.geometry?.dispose();
          child.material?.dispose();
        });
      }
    };
  }, [ready, plateCount, activePlate]);

  useEffect(() => {
    const state = rendererState.current;
    if (!state) return;
    const [width, depth] = settings.buildSize;
    const [lastX, lastY] = plateOffset(plateCount - 1, settings.buildSize);
    const spanX = (plateCount > 1 ? width + 28 : lastX);
    state.overview = {
      mode: view,
      centerX: spanX / 2,
      centerY: lastY / 2,
      diagonal: plateCount === 1 && view === "support" && offsets.length === 1 && model ? Math.max(100, Math.hypot(...model.size)) :
        Math.max(Math.hypot(width + spanX, depth - lastY), model ? Math.hypot(...model.size) : 0),
      targetHeight: view === "support" && placement ? Math.min(65, placement.size[2] * 0.35) : 0,
    };
    state.plate.material.opacity = view === "below" ? 0.08 : plateCount > 1 && activePlate === 0 ? 0.43 : 0.3;
    positionCamera(state);
    state.render();
  }, [ready, model, view, reset, offsets.length, plateCount, activePlate]);

  return <div className={faceMode ? "render-surface face-picking" : "render-surface"} ref={host} role="img" aria-label="แผ่นพิมพ์สามมิติ คลิกซ้ายค้างแล้วลากเพื่อหมุนกล้อง คลิกขวาค้างแล้วลากเพื่อเลื่อนมุมมอง ใช้ล้อเมาส์เพื่อซูม" />;
}
