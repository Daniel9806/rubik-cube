export function bindUi({ cube, input, cameraController }) {
  const resetBtn = document.querySelector('#resetBtn');
  const scrambleBtn = document.querySelector('#scrambleBtn');
  const gestureMode = document.querySelector('#gestureMode');
  const cameraSensitivity = document.querySelector('#cameraSensitivity');

  if (resetBtn) {
    resetBtn.addEventListener('click', () => {
      if (cube.activeTurn) return;
      cube.reset();
    });
  }

  if (scrambleBtn) {
    scrambleBtn.addEventListener('click', () => {
      if (cube.activeTurn) return;
      cube.scramble(22);
    });
  }

  if (gestureMode && input?.setDragMode) {
    input.setDragMode(gestureMode.value);
    gestureMode.addEventListener('change', () => {
      input.setDragMode(gestureMode.value);
    });
  }

  if (cameraSensitivity && cameraController?.setSensitivity) {
    cameraController.setSensitivity(cameraSensitivity.value);
    cameraSensitivity.addEventListener('input', () => {
      cameraController.setSensitivity(cameraSensitivity.value);
    });
  }
}
