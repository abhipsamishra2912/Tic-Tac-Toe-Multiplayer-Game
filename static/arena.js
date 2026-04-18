const uid = localStorage.getItem("uid");
if (!uid) { window.location.href = "/"; }

//State
let mySymbol      = "";
let currentTurn   = "";
let currentRoom   = "";
let gameOver      = false;
let inQueue       = false;
let pendingChallenger = null;

//DOM 
const lobbyScreen   = document.getElementById("lobby-screen");
const gameScreen    = document.getElementById("game-screen");
const statusBox     = document.getElementById("status");
const userContainer = document.getElementById("users");
const findMatchBtn  = document.getElementById("findMatch");
const overlay       = document.getElementById("challenge-overlay");
const challengerName = document.getElementById("challenger-name");
const btnAccept     = document.getElementById("btn-accept");
const btnDecline    = document.getElementById("btn-decline");

const cells         = document.querySelectorAll(".cell");
const statusText    = document.getElementById("game-status");
const logPanel      = document.getElementById("log-panel");
const playerUidEl   = document.getElementById("player-uid");
const playerSymEl   = document.getElementById("player-symbol");
const roomIdEl      = document.getElementById("room-id");
const opponentEl    = document.getElementById("opponent-uid");
const chatMessages  = document.getElementById("chat-messages");
const chatInput     = document.getElementById("chat-input");
const btnSendChat   = document.getElementById("btn-send-chat");
const btnForfeit    = document.getElementById("btn-forfeit");
const btnClearLog   = document.getElementById("btn-clear-log");

playerUidEl.innerText = uid;

//Single WebSocket
const ws = new WebSocket(`ws://${window.location.host}/ws/${uid}`);

ws.onopen = () => {
    console.log("[arena] WS connected");
    statusBox.innerText = "ONLINE";
};

ws.onclose = () => {
    console.log("[arena] WS closed");
    statusBox.innerText = "DISCONNECTED";
};

ws.onerror = (e) => {
    console.error("[arena] WS error", e);
    statusBox.innerText = "CONNECTION_ERROR";
};

ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    console.log("[arena] ←", msg.type, msg);

    switch (msg.type) {

        case "lobby_update":
            renderUsers(msg.online_users);
            break;

        case "challenge_received":
            pendingChallenger = msg.from;
            challengerName.innerText = msg.from;
            overlay.classList.add("visible");
            break;

        case "challenge_declined":
            alert(`${msg.by} declined your challenge.`);
            document.querySelectorAll(".user-card button").forEach(b => {
                b.disabled = false;
                b.innerText = "[ CHALLENGE ]";
            });
            break;

        case "game_start":
            handleGameStart(msg.data);
            break;

        case "game_update":
            handleGameUpdate(msg.data);
            break;

        case "game_end":
            handleGameEnd(msg.data);
            break;

        case "chat":
            addChatMessage(msg.from, msg.message, msg.from === uid);
            break;

        case "error":
            gameLog(`> ERROR: ${msg.message}`);
            break;
    }
};

//Lobby logic 
function renderUsers(users) {
    userContainer.innerHTML = "";
    const others = users.filter(u => u !== uid);

    if (others.length === 0) {
        userContainer.innerHTML =
            `<div class="empty-state">// NO OTHER PLAYERS ONLINE</div>`;
        return;
    }

    others.forEach(u => {
        const div  = document.createElement("div");
        div.className = "user-card";

        const name = document.createElement("span");
        name.innerText = u;

        const btn = document.createElement("button");
        btn.innerText = "[ CHALLENGE ]";
        btn.onclick = () => {
            btn.disabled = true;
            btn.innerText = "[ SENT... ]";
            send({ type: "send_challenge", target_uid: u });
        };

        div.appendChild(name);
        div.appendChild(btn);
        userContainer.appendChild(div);
    });
}

findMatchBtn.onclick = () => {
    if (inQueue) return;
    inQueue = true;
    findMatchBtn.disabled = true;
    findMatchBtn.innerText = "[ SEARCHING... ]";
    send({ type: "find_match" });
};

btnAccept.onclick = () => {
    if (!pendingChallenger) return;
    send({ type: "respond_challenge", challenger_uid: pendingChallenger, accepted: true });
    overlay.classList.remove("visible");
    pendingChallenger = null;
};

btnDecline.onclick = () => {
    if (!pendingChallenger) return;
    send({ type: "respond_challenge", challenger_uid: pendingChallenger, accepted: false });
    overlay.classList.remove("visible");
    pendingChallenger = null;
};

//Game logic
function showGameScreen() {
    lobbyScreen.style.display = "none";
    gameScreen.style.display  = "block";
}

function showLobbyScreen() {
    gameScreen.style.display  = "none";
    lobbyScreen.style.display = "block";
    inQueue = false;
    findMatchBtn.disabled = false;
    findMatchBtn.innerText = "[ INITIATE_RANDOM_MATCHMAKING ]";
}

function handleGameStart(data) {
    mySymbol    = data.symbol;
    currentTurn = data.turn;
    currentRoom = data.room_id;
    gameOver    = false;

    playerSymEl.innerText = mySymbol;
    roomIdEl.innerText    = data.room_id;
    opponentEl.innerText  = data.opponent || "---";

    resetBoard();
    updateStatus();
    showGameScreen();

    gameLog(`> Match started. Room: ${data.room_id}`);
    gameLog(`> You are [ ${mySymbol} ]`);
    gameLog(`> Opponent: ${data.opponent}`);

    if (data.board) {
        updateBoardUI(data.board);
    }
}

function handleGameUpdate(data) {
    console.log("[arena] game_update board:", data.board, "turn:", data.turn);
    updateBoardUI(data.board);
    currentTurn = data.turn;
    updateStatus();
}

function handleGameEnd(data) {
    updateBoardUI(data.board);
    gameOver    = true;
    currentTurn = "";
    cells.forEach(c => c.classList.add("disabled"));

    if (data.winner === uid) {
        statusText.innerHTML =
            `<span style="color:var(--main-green);text-shadow:var(--glow)">VICTORY</span>`;
        gameLog("> You won. ELO updated.");
    } else if (data.winner === null) {
        statusText.innerText = "DRAW — STALEMATE";
        gameLog("> Draw.");
    } else {
        statusText.innerHTML =
            `<span style="color:var(--alert-red)">DEFEAT</span>`;
        gameLog("> You were defeated.");
    }

    setTimeout(() => {
        if (confirm("Return to lobby?")) {
            showLobbyScreen();
        }
    }, 2000);
}

cells.forEach(cell => {
    cell.addEventListener("click", () => {
        if (gameOver)                            return;
        if (!mySymbol)                           return;
        if (currentTurn !== uid)               { gameLog("> Not your turn."); return; }
        if (cell.classList.contains("disabled")) return;

        const position = parseInt(cell.getAttribute("data-index"));

        cell.innerText = mySymbol;
        cell.classList.add("disabled");
        cell.classList.add(mySymbol === "X" ? "symbol-x" : "symbol-o");
        currentTurn = "";
        updateStatus();

        gameLog(`> Move sent: position ${position}`);
        send({ type: "move", room_id: currentRoom, position });
    });
});

function updateBoardUI(board) {
    board.forEach((symbol, i) => {
        cells[i].innerText = symbol || "";
        cells[i].classList.remove("symbol-x", "symbol-o", "disabled");
        if (symbol) {
            cells[i].classList.add("disabled");
            cells[i].classList.add(symbol === "X" ? "symbol-x" : "symbol-o");
        }
    });
}

function resetBoard() {
    cells.forEach(c => {
        c.innerText = "";
        c.classList.remove("disabled", "symbol-x", "symbol-o");
    });
}

function updateStatus() {
    if (!mySymbol) { statusText.innerText = "WAITING FOR MATCH..."; return; }
    statusText.innerText = currentTurn === uid
        ? ">> YOUR TURN <<"
        : "Waiting for opponent...";
}

function sendChat() {
    const text = chatInput.value.trim();
    if (!text || !currentRoom) return;
    send({ type: "chat", room_id: currentRoom, message: text });
    chatInput.value = "";
}
btnSendChat.onclick = sendChat;
chatInput.addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });

function addChatMessage(from, message, isMe) {
    const p = document.createElement("p");
    p.className = isMe ? "chat-me" : "chat-them";
    p.innerText = `${isMe ? "YOU" : from}: ${message}`;
    chatMessages.appendChild(p);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}

btnForfeit.onclick = () => {
    if (gameOver) return;
    if (!confirm("Forfeit this match?")) return;
    send({ type: "forfeit", room_id: currentRoom });
    gameLog("> You forfeited.");
};

btnClearLog.onclick = () => { logPanel.innerHTML = ""; };

function send(obj) {
    if (ws.readyState !== WebSocket.OPEN) {
        console.error("[arena] WS not open, cannot send:", obj);
        return;
    }
    console.log("[arena] →", obj.type, obj);
    ws.send(JSON.stringify(obj));
}

function gameLog(msg) {
    const p = document.createElement("p");
    p.innerText = msg;
    logPanel.appendChild(p);
    logPanel.scrollTop = logPanel.scrollHeight;
}