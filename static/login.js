const video = document.getElementById("videoFeed");
const canvas = document.getElementById("captureCanvas");

const btnCamera = document.getElementById("btnCamera");
const btnLogin = document.getElementById("btnLogin");

const cameraIdle = document.getElementById("cameraIdle");
const cameraScan = document.getElementById("cameraScan");

const statusBox = document.getElementById("statusBox");
const statusMsg = document.getElementById("statusMsg");

let stream = null;
let socket = null;

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
    btnLogin.disabled = true;
    showStatus("Scanning face...", "loading");
    cameraScan.hidden = false;

    console.log("capturing frame...");

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;

    console.log("canvas size:", canvas.width, canvas.height);

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);

    const base64Image = canvas.toDataURL("image/jpeg");
    console.log("sending to /login...");
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
            stream.getTracks().forEach(track => track.stop());
            video.style.display = "none";

            btnCamera.disabled = true;
            btnLogin.disabled = true;

            showStatus("Finding match...", "success");

            const wsProtocol = location.protocol === "https:" ? "wss" : "ws";

            socket = new WebSocket(`${wsProtocol}://${location.hostname}:8000/ws/${data.uid}`);

            socket.onopen = () => {
                console.log("WebSocket connected");

                socket.send(JSON.stringify({
                    type: "find_match"
                }));
            };

            let myRoomId = null;
            let mySymbol = null;
            let myTurn = false;
            
            socket.onmessage = (event) => {
                const msg = JSON.parse(event.data);
            
                if (msg.type === "game_start") {
                    myRoomId = msg.data.room_id;
                    mySymbol = msg.data.symbol;
                    myTurn = msg.data.turn === data.uid;
                    showStatus("Match found! Game starting...", "success");
                    // redirect to dashboard when ready
                    // window.location.href = "/dashboard";
                }
            
                else if (msg.type === "game_update") {
                    myTurn = msg.data.turn === data.uid;
                    console.log("Board:", msg.data.board);
                }
            
                else if (msg.type === "game_end") {
                    const won = msg.data.winner === data.uid;
                    showStatus(won ? "You won!" : msg.data.winner ? "You lost!" : "Draw!", "success");
                }
            
                else if (msg.type === "error") {
                    showStatus(msg.message, "error");
                }
            
                else if (msg.type === "chat") {
                    console.log(`${msg.from}: ${msg.message}`);
                }
            };

            socket.onerror = (err) => {
                console.log("WebSocket error:", err);
            };

            socket.onclose = () => {
                console.log("WebSocket closed");
            };

        } else {
            showStatus(data.message || "Face not recognised", "error");
        }

    } catch (err) {
        cameraScan.hidden = true;
        showStatus("Server error", "error");
    }
};