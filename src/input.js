import * as THREE from 'three';

function dominantAxis(v) {
  const ax = Math.abs(v.x);
  const ay = Math.abs(v.y);
  const az = Math.abs(v.z);
  if (ax >= ay && ax >= az) return { axis: 'x', sign: Math.sign(v.x) || 1 };
  if (ay >= ax && ay >= az) return { axis: 'y', sign: Math.sign(v.y) || 1 };
  return { axis: 'z', sign: Math.sign(v.z) || 1 };
}

export function createCubeInput({ canvas, camera, cube, cameraController }) {
  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();

  let dragMode = 'auto';

  let drag = null;

  const tmpInvQ = new THREE.Quaternion();
  const tmpForward = new THREE.Vector3();
  const tmpRight = new THREE.Vector3();
  const tmpUp = new THREE.Vector3();
  const tmpDragWorld = new THREE.Vector3();
  const tmpDragOnPlane = new THREE.Vector3();
  const tmpAxisWorld = new THREE.Vector3();
  const tmpAxisLocal = new THREE.Vector3();

  function getPointerNdc(ev) {
    const rect = canvas.getBoundingClientRect();
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    pointer.y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);
  }

  function worldNormalToLocal(normalWorld) {
    const qInv = cube.baseGroup.quaternion.clone().invert();
    return normalWorld.clone().applyQuaternion(qInv);
  }

  function gridIndexFromPosition(value) {
    return Math.round(value / cube.spacing);
  }

  function onPointerDown(ev) {
    if (cube.activeTurn) return;

    getPointerNdc(ev);
    raycaster.setFromCamera(pointer, camera);

    const hits = raycaster.intersectObjects(cube.cubelets, false);
    if (!hits.length) {
      cameraController?.onPointerDown?.(ev, true);
      return;
    }

    const hit = hits[0];
    const faceNormalWorld = hit.face.normal.clone().transformDirection(hit.object.matrixWorld);
    faceNormalWorld.normalize();

    drag = {
      startX: ev.clientX,
      startY: ev.clientY,
      cubelet: hit.object,
      faceNormalWorld,
      moved: false,
      pointerId: ev.pointerId,
    };

    canvas.setPointerCapture(ev.pointerId);
  }

  function onPointerMove(ev) {
    if (cameraController?.onPointerMove?.(ev)) return;

    if (!drag || cube.activeTurn) return;
    if (ev.pointerId !== drag.pointerId) return;

    const dx = ev.clientX - drag.startX;
    const dy = ev.clientY - drag.startY;

    const threshold = 10;
    if (!drag.moved && Math.hypot(dx, dy) < threshold) return;
    drag.moved = true;

    let dxx = dx;
    let dyy = dy;
    if (dragMode === 'horizontal') dyy = 0;
    if (dragMode === 'vertical') dxx = 0;

    // Base de cámara en mundo
    camera.getWorldDirection(tmpForward).normalize();
    tmpRight.crossVectors(tmpForward, camera.up).normalize();
    tmpUp.crossVectors(tmpRight, tmpForward).normalize();

    // Convertir drag 2D a un vector en mundo (arriba en pantalla = +up)
    tmpDragWorld
      .copy(tmpRight)
      .multiplyScalar(dxx)
      .addScaledVector(tmpUp, -dyy);

    if (tmpDragWorld.lengthSq() < 1e-8) return;
    tmpDragWorld.normalize();

    // Proyectar el drag al plano de la cara
    const n = drag.faceNormalWorld;
    tmpDragOnPlane.copy(tmpDragWorld).addScaledVector(n, -tmpDragWorld.dot(n));
    if (tmpDragOnPlane.lengthSq() < 1e-8) return;
    tmpDragOnPlane.normalize();

    // Eje de giro: normal x dirección de drag en el plano.
    tmpAxisWorld.crossVectors(n, tmpDragOnPlane);
    if (tmpAxisWorld.lengthSq() < 1e-8) return;
    tmpAxisWorld.normalize();

    // Pasar a local del cubo para snapear a eje X/Y/Z
    tmpInvQ.copy(cube.baseGroup.quaternion).invert();
    tmpAxisLocal.copy(tmpAxisWorld).applyQuaternion(tmpInvQ);

    const { axis: rotateAxis, sign } = dominantAxis(tmpAxisLocal);
    const dir = sign;

    const layerIndex = gridIndexFromPosition(drag.cubelet.position[rotateAxis]);
    cube.beginTurn({ axis: rotateAxis, layerIndex, dir });

    drag = null;
  }

  function onPointerUp(ev) {
    if (cameraController?.onPointerUp?.(ev)) return;

    drag = null;
    try {
      canvas.releasePointerCapture(ev.pointerId);
    } catch {
      // ignore
    }
  }

  function bind() {
    canvas.addEventListener('pointerdown', onPointerDown);
    canvas.addEventListener('pointermove', onPointerMove);
    canvas.addEventListener('pointerup', onPointerUp);
    canvas.addEventListener('pointercancel', onPointerUp);
  }

  function setDragMode(mode) {
    dragMode = mode === 'horizontal' || mode === 'vertical' ? mode : 'auto';
  }

  return { bind, setDragMode };
}
