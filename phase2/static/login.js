const video = document.getElementById("videoFeed");
const canvas = document.getElementById("captureCanvas");

const btnCamera = document.getElementById("btnCamera");
const btnLogin = document.getElementById("btnLogin");

const cameraIdle = document.getElementById("cameraIdle");
const cameraScan = document.getElementById("cameraScan");

const statusBox = document.getElementById("statusBox");
const statusMsg = document.getElementById("statusMsg");

let stream = null;

function showStatus(msg, type = "loading") {
  statusBox.hidden = false;
  statusMsg.textContent = msg;

  statusBox.className = "status";
  if (type === "success") statusBox.classList.add("status--success");
  else if (type === "error") statusBox.classList.add("status--error");
  else statusBox.classList.add("status--loading");
}

btnCamera.onclick = async () => {
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: true });

    video.srcObject = stream;
    video.style.display = "block";

    cameraIdle.classList.add("hidden");
    btnLogin.disabled = false;

    showStatus("Camera ready", "success");
  } catch (e) {
    showStatus("Camera access denied", "error");
  }
};

btnLogin.onclick = async () => {
  if (!stream) return;

  showStatus("Scanning face...", "loading");
  cameraScan.hidden = false;

  // capture frame
  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  const ctx = canvas.getContext("2d");
  ctx.drawImage(video, 0, 0);

  const base64Image = canvas.toDataURL("image/jpeg");

  try {
    const res = await fetch("/login", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        image: base64Image 
      })
    });

    const data = await res.json();

    cameraScan.hidden = true;

    if (data.status === "success") {
      showStatus("Welcome! Logging you in...", "success");

      setTimeout(() => {
        window.location.href = "/dashboard";
      }, 1000);

    } else {
      showStatus(data.message || "Face not recognised", "error");
    }

  } catch (err) {
    cameraScan.hidden = true;
    showStatus("Server error", "error");
  }
};

const toggleBtn = document.getElementById("theme-toggle");

if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    toggleBtn.textContent = "🌙";
}

toggleBtn.addEventListener("click", () => {
    document.body.classList.toggle("dark");

    if (document.body.classList.contains("dark")) {
        localStorage.setItem("theme", "dark");
        toggleBtn.textContent = "🌙";
    }
    else {
        localStorage.setItem("theme", "light");
        toggleBtn.textContent = "☀️";
    }
});