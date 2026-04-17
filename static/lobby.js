const uid = localStorage.getItem("uid");

if (!uid) {
    window.location.href = "/";
} else {
    initLobby();
}

function initLobby() {
    const statusBox    = document.getElementById("status");
    const userContainer = document.getElementById("users");
    const findMatchBtn  = document.getElementById("findMatch");
    const overlay       = document.getElementById("challenge-overlay");
    const challengerName = document.getElementById("challenger-name");
    const btnAccept     = document.getElementById("btn-accept");
    const btnDecline    = document.getElementById("btn-decline");

    let pendingChallenger = null;
    let inQueue = false;

    const ws = new WebSocket(`ws://${window.location.host}/ws/${uid}`);

    ws.onopen = () => {
        statusBox.innerText = "ONLINE";
    };

    ws.onclose = () => {
        statusBox.innerText = "DISCONNECTED";
    };

    ws.onerror = () => {
        statusBox.innerText = "CONNECTION_ERROR";
    };

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);

        if (msg.type === "lobby_update") {
            renderUsers(msg.online_users);
        }

        if (msg.type === "challenge_received") {
            pendingChallenger = msg.from;
            challengerName.innerText = msg.from;
            overlay.classList.add("visible");
        }

        if (msg.type === "challenge_declined") {
            alert(`${msg.by} declined your challenge.`);
        }

        if (msg.type === "game_start") {
            localStorage.setItem("room_id", msg.data.room_id);
            window.location.href = `/static/game.html?room=${msg.data.room_id}`;
        }

        if (msg.type === "error") {
            statusBox.innerText = msg.message;
        }
    };

    // Accept challenge
    btnAccept.onclick = () => {
        if (!pendingChallenger) return;
        ws.send(JSON.stringify({
            type: "respond_challenge",
            challenger_uid: pendingChallenger,
            accepted: true
        }));
        overlay.classList.remove("visible");
        pendingChallenger = null;
    };

    // Decline challenge
    btnDecline.onclick = () => {
        if (!pendingChallenger) return;
        ws.send(JSON.stringify({
            type: "respond_challenge",
            challenger_uid: pendingChallenger,
            accepted: false
        }));
        overlay.classList.remove("visible");
        pendingChallenger = null;
    };

    // Random matchmaking
    findMatchBtn.onclick = () => {
        if (inQueue) return;
        inQueue = true;
        findMatchBtn.disabled = true;
        findMatchBtn.innerText = "[ SEARCHING... ]";
        ws.send(JSON.stringify({ type: "find_match" }));
    };

    function renderUsers(users) {
        userContainer.innerHTML = "";

        const others = users.filter(u => u !== uid);

        if (others.length === 0) {
            const empty = document.createElement("div");
            empty.className = "empty-state";
            empty.innerText = "// NO OTHER PLAYERS ONLINE";
            userContainer.appendChild(empty);
            return;
        }

        others.forEach(u => {
            const div = document.createElement("div");
            div.className = "user-card";

            const nameSpan = document.createElement("span");
            nameSpan.innerText = u;

            const btn = document.createElement("button");
            btn.innerText = "[ CHALLENGE ]";
            btn.onclick = () => {
                btn.disabled = true;
                btn.innerText = "[ SENT... ]";
                ws.send(JSON.stringify({
                    type: "send_challenge",
                    target_uid: u
                }));
            };

            div.appendChild(nameSpan);
            div.appendChild(btn);
            userContainer.appendChild(div);
        });
    }
}