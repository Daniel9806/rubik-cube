import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';

const GRID = 3;
const SPACING = 1.08;
const HALF = (GRID - 1) / 2;

const FACE_COLORS = {
  px: 0xe53935,
  nx: 0xff8f00,
  py: 0xffffff,
  ny: 0xffeb3b,
  pz: 0x43a047,
  nz: 0x1e88e5,
};

const INSIDE = 0x10131a;

function gridIndexFromPosition(value) {
  return Math.round(value / SPACING);
}

function makeCubeletMaterial(x, y, z) {
  const mats = [];

  const isPx = x === HALF;
  const isNx = x === -HALF;
  const isPy = y === HALF;
  const isNy = y === -HALF;
  const isPz = z === HALF;
  const isNz = z === -HALF;

  const colorFor = (flag, color) => (flag ? color : INSIDE);

  mats.push(
    new THREE.MeshStandardMaterial({ color: colorFor(isPx, FACE_COLORS.px), roughness: 0.35, metalness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: colorFor(isNx, FACE_COLORS.nx), roughness: 0.35, metalness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: colorFor(isPy, FACE_COLORS.py), roughness: 0.35, metalness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: colorFor(isNy, FACE_COLORS.ny), roughness: 0.35, metalness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: colorFor(isPz, FACE_COLORS.pz), roughness: 0.35, metalness: 0.05 }),
    new THREE.MeshStandardMaterial({ color: colorFor(isNz, FACE_COLORS.nz), roughness: 0.35, metalness: 0.05 })
  );

  return mats;
}

function snapCubeletTransform(mesh) {
  mesh.position.x = Math.round(mesh.position.x / SPACING) * SPACING;
  mesh.position.y = Math.round(mesh.position.y / SPACING) * SPACING;
  mesh.position.z = Math.round(mesh.position.z / SPACING) * SPACING;

  const e = new THREE.Euler().setFromQuaternion(mesh.quaternion, 'XYZ');
  const snap = (a) => Math.round(a / (Math.PI / 2)) * (Math.PI / 2);
  e.x = snap(e.x);
  e.y = snap(e.y);
  e.z = snap(e.z);
  mesh.quaternion.setFromEuler(e);
}

function selectLayer(cubelets, axis, layerIndex) {
  const selected = [];
  for (const c of cubelets) {
    const idx = gridIndexFromPosition(c.position[axis]);
    if (idx === layerIndex) selected.push(c);
  }
  return selected;
}

export function createRubiksCube(scene) {
  const baseGroup = new THREE.Group();
  scene.add(baseGroup);

  const cubelets = [];

  let activeTurn = null;

  const tmpDir = new THREE.Vector3();
  const tmpN = new THREE.Vector3();
  const localNormals = [
    new THREE.Vector3(1, 0, 0),
    new THREE.Vector3(-1, 0, 0),
    new THREE.Vector3(0, 1, 0),
    new THREE.Vector3(0, -1, 0),
    new THREE.Vector3(0, 0, 1),
    new THREE.Vector3(0, 0, -1),
  ];

  function buildCube() {
    cubelets.length = 0;
    baseGroup.clear();

    let geom;
    try {
      geom = new RoundedBoxGeometry(1, 1, 1, 4, 0.08);
    } catch {
      geom = new THREE.BoxGeometry(1, 1, 1);
    }
    const edgesGeom = new THREE.EdgesGeometry(geom, 35);

    for (let xi = 0; xi < GRID; xi++) {
      for (let yi = 0; yi < GRID; yi++) {
        for (let zi = 0; zi < GRID; zi++) {
          const x = xi - HALF;
          const y = yi - HALF;
          const z = zi - HALF;

          const mats = makeCubeletMaterial(x, y, z);
          const mesh = new THREE.Mesh(geom, mats);
          mesh.position.set(x * SPACING, y * SPACING, z * SPACING);

          const edges = new THREE.LineSegments(
            edgesGeom,
            new THREE.LineBasicMaterial({ color: 0x0b0f17, transparent: true, opacity: 0.9 })
          );
          edges.scale.setScalar(1.001);
          mesh.add(edges);

          baseGroup.add(mesh);
          cubelets.push(mesh);
        }
      }
    }
  }

  function beginTurn({ axis, layerIndex, dir }) {
    if (activeTurn) return false;

    const pivot = new THREE.Group();
    baseGroup.add(pivot);

    const selected = selectLayer(cubelets, axis, layerIndex);
    for (const m of selected) pivot.attach(m);

    activeTurn = {
      axis,
      dir,
      pivot,
      selected,
      target: dir * (Math.PI / 2),
      current: 0,
      speed: 10,
    };

    return true;
  }

  function updateTurn(dt) {
    if (!activeTurn) return;

    const t = activeTurn;
    const step = Math.min(Math.abs(t.target - t.current), t.speed * dt);
    const delta = step * Math.sign(t.target - t.current);
    t.current += delta;

    if (t.axis === 'x') t.pivot.rotateX(delta);
    if (t.axis === 'y') t.pivot.rotateY(delta);
    if (t.axis === 'z') t.pivot.rotateZ(delta);

    if (Math.abs(t.target - t.current) < 1e-4) {
      for (const m of t.selected) {
        baseGroup.attach(m);
        snapCubeletTransform(m);
      }
      baseGroup.remove(t.pivot);
      t.pivot.clear();
      activeTurn = null;
    }
  }

  function getStickerColorForDirection(cubelet, dirWorld) {
    // Determina qué cara del cubito apunta más hacia dirWorld
    // y devuelve el color del material correspondiente.
    let bestIdx = 0;
    let bestDot = -Infinity;

    for (let i = 0; i < localNormals.length; i++) {
      tmpN.copy(localNormals[i]).applyQuaternion(cubelet.quaternion);
      const d = tmpN.dot(dirWorld);
      if (d > bestDot) {
        bestDot = d;
        bestIdx = i;
      }
    }

    const mat = Array.isArray(cubelet.material) ? cubelet.material[bestIdx] : cubelet.material;
    return mat?.color?.getHex?.() ?? null;
  }

  function isSolved() {
    if (activeTurn) return false;

    const faces = [
      { axis: 'x', idx: 1, dir: new THREE.Vector3(1, 0, 0) },
      { axis: 'x', idx: -1, dir: new THREE.Vector3(-1, 0, 0) },
      { axis: 'y', idx: 1, dir: new THREE.Vector3(0, 1, 0) },
      { axis: 'y', idx: -1, dir: new THREE.Vector3(0, -1, 0) },
      { axis: 'z', idx: 1, dir: new THREE.Vector3(0, 0, 1) },
      { axis: 'z', idx: -1, dir: new THREE.Vector3(0, 0, -1) },
    ];

    for (const f of faces) {
      let expected = null;

      for (const c of cubelets) {
        const coordIndex = Math.round(c.position[f.axis] / SPACING);
        if (coordIndex !== f.idx) continue;

        tmpDir.copy(f.dir);
        const color = getStickerColorForDirection(c, tmpDir);
        if (color == null) return false;

        if (expected == null) expected = color;
        else if (color !== expected) return false;
      }

      if (expected == null) return false;
    }

    return true;
  }

  function randomTurn() {
    const axes = ['x', 'y', 'z'];
    const axis = axes[Math.floor(Math.random() * axes.length)];
    const layerIndex = [-1, 0, 1][Math.floor(Math.random() * 3)];
    const dir = Math.random() > 0.5 ? 1 : -1;
    beginTurn({ axis, layerIndex, dir });
  }

  async function scramble(n = 20) {
    for (let i = 0; i < n; i++) {
      if (activeTurn) {
        await new Promise((r) => setTimeout(r, 20));
        i--;
        continue;
      }
      randomTurn();
      await new Promise((r) => setTimeout(r, 140));
    }
  }

  function reset() {
    if (activeTurn) return;
    buildCube();
  }

  buildCube();

  return {
    baseGroup,
    cubelets,
    spacing: SPACING,
    beginTurn,
    updateTurn,
    scramble,
    reset,
    isSolved,
    get activeTurn() {
      return activeTurn;
    },
  };
}
