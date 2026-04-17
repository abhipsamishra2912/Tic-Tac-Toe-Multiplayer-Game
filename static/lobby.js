const uid = localStorage.getItem("uid");
let ws = null;
let currentRoomId = null;
let mySymbol = null;
let currentTurn = null;

if (!uid) { window.location.href = "/"; } else { init(); }

function init() {
    ws = new WebSocket(`ws://${window.location.host}/ws/${uid}`);

    ws.onmessage = (event) => {
        const msg = JSON.parse(event.data);
        console.log("RECV:", msg);

        switch(msg.type) {
            case "lobby_update":
                renderUsers(msg.online_users);
                break;
            case "challenge_received":
                const accepted = confirm(`Incoming Challenge from: ${msg.from}\nDo you accept?`);
    
                ws.send(JSON.stringify({
                    type: "respond_challenge",
                    challenger_uid: msg.from,
                    accepted: accepted
                }));
                break;
            case "game_start":
                console.log("GAME_START received:", msg.data);
                setupGame(msg.data);
                break;
            case "game_update":
                updateBoard(msg.data);
                break;
            case "game_end":
                finishGame(msg.data);
                break;
            case "error":
                alert("SYSTEM_ERROR: " + msg.message);
                break;
        }
    };
}

function renderUsers(users) {
    const container = document.getElementById("users");
    container.innerHTML = users.filter(u => u !== uid).map(u => `
        <div class="user-card">
            <span>${u}</span>
            <button onclick="challenge('${u}')">CHALLENGE</button>
        </div>
    `).join('');
}

function challenge(target) {
    ws.send(JSON.stringify({type: "send_challenge", target_uid: target}));
}

function setupGame(data) {
    currentRoomId = data.room_id;
    mySymbol = data.symbol;
    currentTurn = data.turn;

    document.getElementById("lobby-screen").style.display = "none";
    document.getElementById("game-screen").style.display = "block";
    document.getElementById("player-uid").innerText = uid;
    document.getElementById("player-symbol").innerText = mySymbol;
    
    updateStatus();
}

function updateBoard(data) {
    currentTurn = data.turn;
    const cells = document.querySelectorAll(".cell");
    data.board.forEach((val, i) => {
        cells[i].innerText = val || "";
        if (val) cells[i].classList.add("disabled");
    });
    updateStatus();
}

function updateStatus() {
    const status = document.getElementById("game-status");
    if (currentTurn === uid) {
        status.innerText = ">> YOUR TURN <<";
        status.style.color = "var(--main-green)";
    } else {
        status.innerText = "WAITING FOR OPPONENT...";
        status.style.color = "var(--dark-green)";
    }
}

document.querySelectorAll(".cell").forEach(cell => {
    cell.onclick = (e) => {
        const pos = e.target.dataset.index;
        if (currentTurn === uid && !e.target.innerText) {
            ws.send(JSON.stringify({
                type: "move",
                room_id: currentRoomId,
                position: parseInt(pos)
            }));
        }
    };
});

function finishGame(data) {
    const winMsg = data.winner === uid ? "VICTORY" : (data.winner ? "DEFEATED" : "DRAW");
    alert(`MATCH_TERMINATED: ${winMsg}`);
    location.reload(); 
}

document.getElementById("findMatch").onclick = () => ws.send(JSON.stringify({type:"find_match"}));

function setupGame(data) {
    // 1. Store game details
    currentRoomId = data.room_id;
    mySymbol = data.symbol;
    currentTurn = data.turn;

    // 2. SWAP THE VIEWS (This is your "Redirect")
    document.getElementById("lobby-screen").style.display = "none";
    document.getElementById("game-screen").style.display = "block";

    // 3. Update the UI labels
    document.getElementById("player-uid").innerText = uid;
    document.getElementById("player-symbol").innerText = mySymbol;
    
    // 4. Log it to your terminal-style log
    const log = document.getElementById("log-panel");
    log.innerHTML += `<p>> MATCH_STARTED: ROOM_${currentRoomId.slice(0,4)}</p>`;
    
    updateStatus();
}