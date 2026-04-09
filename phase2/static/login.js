'use strict';

const videoEl = document.getElementById('videoFeed');
const canvasEl = document.getElementById('captureCanvas');
const btnCamera = document.getElementById('btnCamera');
const btnLogin = document.getElementById('btnLogin');
const cameraIdle = document.getElementById('cameraIdle');
const cameraScan = document.getElementById('cameraScan');
const statusBox = document.getElementById('statusBox');
const statusMsg = document.getElementById('statusMsg');

let mediaStream = null;
let cameraActive = false;

function showStatus(msg, type = 'loading') {
  statusBox.hidden = false;
  statusBox.className = `status status--${type}`;
  statusMsg.textContent = msg;
}

function hideStatus() {
  statusBox.hidden = true;
}

async function startCamera() {
  showStatus('Requesting camera access…', 'loading');
  btnCamera.disabled = true;

  try {
    mediaStream = await navigator.mediaDevices.getUserMedia({
      video: {
        facingMode: 'user',
        width: { ideal: 640 },
        height: { ideal: 480 }
      },
      audio: false
    });

    videoEl.srcObject = mediaStream;
    videoEl.style.display = 'block';

    cameraIdle.classList.add('hidden');

    cameraActive = true;

    btnCamera.querySelector('span:last-child').textContent = 'Stop Camera';
    btnCamera.disabled = false;
    btnLogin.disabled = false;

    showStatus('Camera active — position your face in the frame', 'loading');

  } catch (err) {
    console.error('getUserMedia error:', err);

    showStatus(
      err.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow camera permissions and reload.'
        : `Camera error: ${err.message}`,
      'error'
    );

    btnCamera.disabled = false;
  }
}

function stopCamera() {
  if (mediaStream) {
    mediaStream.getTracks().forEach(track => track.stop());
    mediaStream = null;
  }

  videoEl.srcObject = null;
  videoEl.style.display = 'none';

  cameraIdle.classList.remove('hidden');

  cameraActive = false;

  btnLogin.disabled = true;
  btnCamera.querySelector('span:last-child').textContent = 'Start Camera';

  hideStatus();
}

btnCamera.addEventListener('click', () => {
  cameraActive ? stopCamera() : startCamera();
});

async function verifyIdentity() {
  if (!cameraActive) return;

  btnLogin.disabled = true;
  btnCamera.disabled = true;

  cameraScan.hidden = false;

  showStatus('Scanning… please hold still', 'loading');

  canvasEl.width = videoEl.videoWidth || 640;
  canvasEl.height = videoEl.videoHeight || 480;

  const ctx = canvasEl.getContext('2d');

  ctx.save();
  ctx.scale(-1, 1);
  ctx.drawImage(videoEl, -canvasEl.width, 0, canvasEl.width, canvasEl.height);
  ctx.restore();

  const imageDataUrl = canvasEl.toDataURL('image/jpeg', 0.9);

  try {
    const response = await fetch('/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ image_data: imageDataUrl })
    });

    const data = await response.json();

    if (response.ok && data.success) {
      showStatus(`✓ Welcome, ${data.name}! Redirecting…`, 'success');

      cameraScan.hidden = true;

      stopCamera();

      setTimeout(() => {
        window.location.href = '/dashboard';
      }, 1200);

    } else {
      showStatus(
        data.detail || data.message || 'Face not recognised. Please try again.',
        'error'
      );

      cameraScan.hidden = true;

      btnLogin.disabled = false;
      btnCamera.disabled = false;
    }

  } catch (err) {
    console.error('Network error during login:', err);

    showStatus('Cannot reach server. Is the backend running?', 'error');

    cameraScan.hidden = true;

    btnLogin.disabled = false;
    btnCamera.disabled = false;
  }
}

btnLogin.addEventListener('click', verifyIdentity);

document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !btnLogin.disabled) {
    verifyIdentity();
  }
});