import * as THREE from 'three';

function clamp(v, a, b) {
  return Math.max(a, Math.min(b, v));
}

export function createOrbitCameraController({ canvas, camera }) {
  const target = new THREE.Vector3(0, 0, 0);

  const initialOffset = camera.position.clone().sub(target);
  const initialRadius = initialOffset.length() || 10;
  const dir = initialOffset.lengthSq() > 0 ? initialOffset.clone().normalize() : new THREE.Vector3(0, 0, 1);
  const orientation = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);

  const orbit = {
    target,
    radius: initialRadius,
    minRadius: 6,
    maxRadius: 20,
    damping: 0.12,
    vRadius: 0,
    q: orientation,
  };

  let sensitivity = 1;

  const worldUp = new THREE.Vector3(0, 1, 0);
  const tmpV1 = new THREE.Vector3();
  const tmpV2 = new THREE.Vector3();
  const tmpAxis = new THREE.Vector3();
  const tmpQuat = new THREE.Quaternion();

  let orbitDrag = null;

  function projectToArcball(ev) {
    const rect = canvas.getBoundingClientRect();
    const x = ((ev.clientX - rect.left) / rect.width) * 2 - 1;
    const y = -(((ev.clientY - rect.top) / rect.height) * 2 - 1);

    // Esfera de radio 1 centrada en el viewport.
    const d2 = x * x + y * y;
    if (d2 <= 1) {
      return new THREE.Vector3(x, y, Math.sqrt(1 - d2));
    }

    // Fuera de la esfera: proyectar al borde (z = 0) y normalizar.
    const v = new THREE.Vector3(x, y, 0);
    return v.normalize();
  }

  function updateCameraFromOrbit() {
    orbit.radius = clamp(orbit.radius, orbit.minRadius, orbit.maxRadius);

    const offset = new THREE.Vector3(0, 0, orbit.radius).applyQuaternion(orbit.q);
    camera.position.copy(orbit.target).add(offset);
    camera.up.copy(worldUp).applyQuaternion(orbit.q);
    camera.lookAt(orbit.target);
  }

  function onPointerDown(ev, force = false) {
    const isOrbitGesture = force || ev.button === 2 || ev.shiftKey;
    if (!isOrbitGesture) return false;

    orbitDrag = {
      lastX: ev.clientX,
      lastY: ev.clientY,
      pointerId: ev.pointerId,
      prev: projectToArcball(ev),
    };

    canvas.setPointerCapture(ev.pointerId);
    return true;
  }

  function onPointerMove(ev) {
    if (!orbitDrag) return false;
    if (ev.pointerId !== orbitDrag.pointerId) return true;

    const curr = projectToArcball(ev);
    tmpV1.copy(orbitDrag.prev).normalize();
    tmpV2.copy(curr).normalize();

    // Arcball: delta en espacio de cámara (pantalla). Aplicarlo como post-multiply
    // para que el gesto siga la dirección del mouse sin invertir ejes.
    tmpQuat.setFromUnitVectors(tmpV1, tmpV2);

    // Control de sensibilidad: escalar el ángulo del delta.
    const axis = tmpAxis.set(tmpQuat.x, tmpQuat.y, tmpQuat.z);
    const axisLen = axis.length();
    if (axisLen > 1e-10) {
      axis.multiplyScalar(1 / axisLen);
      const angle = 2 * Math.atan2(axisLen, tmpQuat.w);
      tmpQuat.setFromAxisAngle(axis, angle * sensitivity);
      orbit.q.multiply(tmpQuat);
      orbit.q.normalize();
      updateCameraFromOrbit();
    }

    orbitDrag.prev = curr;
    orbitDrag.lastX = ev.clientX;
    orbitDrag.lastY = ev.clientY;

    return true;
  }

  function onPointerUp(ev) {
    if (!orbitDrag) return false;
    if (ev.pointerId !== orbitDrag.pointerId) return true;

    orbitDrag = null;
    try {
      canvas.releasePointerCapture(ev.pointerId);
    } catch {
      // ignore
    }

    return true;
  }

  function onWheel(ev) {
    ev.preventDefault();
    const zoomSpeed = 0.004;
    orbit.vRadius += ev.deltaY * zoomSpeed;
  }

  function update(dt) {
    orbit.radius += orbit.vRadius;

    const damp = Math.pow(1 - orbit.damping, dt * 60);
    orbit.vRadius *= damp;
    updateCameraFromOrbit();
  }

  function bind() {
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener(
      'wheel',
      (ev) => {
        onWheel(ev);
      },
      { passive: false }
    );
  }

  updateCameraFromOrbit();

  return {
    bind,
    update,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    setSensitivity(value) {
      const v = Number(value);
      if (!Number.isFinite(v)) return;
      sensitivity = clamp(v, 0.05, 5);
    },
    getSensitivity() {
      return sensitivity;
    },
  };
}
