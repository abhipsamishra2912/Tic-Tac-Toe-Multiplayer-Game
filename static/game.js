const uid    = localStorage.getItem("uid");
const roomId = new URLSearchParams(window.location.search).get("room")
            || localStorage.getItem("room_id");

if (!uid || !roomId) {
    window.location.href = "/static/lobby.html";
}

// Read data stored by lobby.js before redirect
let mySymbol    = localStorage.getItem("my_symbol")  || "";
let currentTurn = localStorage.getItem("first_turn") || "";
let gameOver    = false;
let currentRoom = roomId;

// DOM
const cells          = document.querySelectorAll(".cell");
const statusText     = document.getElementById("game-status");
const logPanel       = document.getElementById("log-panel");
const playerUidEl    = document.getElementById("player-uid");
const playerSymbolEl = document.getElementById("player-symbol");
const playerEloEl    = document.getElementById("player-elo");
const roomIdEl       = document.getElementById("room-id");
const opponentEl     = document.getElementById("opponent-uid");
const chatMessages   = document.getElementById("chat-messages");
const chatInput      = document.getElementById("chat-input");
const btnSendChat    = document.getElementById("btn-send-chat");
const btnForfeit     = document.getElementById("btn-forfeit");
const btnClearLog    = document.getElementById("btn-clear-log");

// Populate UI immediately from localStorage
playerUidEl.innerText    = uid;
playerSymbolEl.innerText = mySymbol || "---";
roomIdEl.innerText       = roomId;
opponentEl.innerText     = localStorage.getItem("opponent_uid") || "---";
updateStatus();

// WebSocket
const ws = new WebSocket(`ws://${window.location.host}/ws/${uid}`);

ws.onopen = () => {
    log("> Connection established.");
    updateStatus();
};

ws.onclose = () => {
    log("> Disconnected.");
    if (!gameOver) statusText.innerText = "DISCONNECTED";
};

ws.onerror = (e) => {
    log("> WebSocket error.");
    console.error(e);
};

ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);
    console.log("[game.js] received:", msg.type, msg);

    // game_start is resent by server on reconnect — use it to restore state
    if (msg.type === "game_start") {
        const d     = msg.data;
        mySymbol    = d.symbol;
        currentTurn = d.turn;
        currentRoom = d.room_id;

        playerSymbolEl.innerText = mySymbol;
        roomIdEl.innerText       = d.room_id;
        opponentEl.innerText     = d.opponent || "---";

        // Restore board if server sent current board state
        if (d.board) {
            updateBoardUI(d.board);
        } else {
            resetBoard();
        }

        updateStatus();
        log(`> Game data received. You are [ ${mySymbol} ]`);
    }

    else if (msg.type === "game_update") {
        console.log("[game.js] game_update board:", msg.data.board);
        updateBoardUI(msg.data.board);
        currentTurn = msg.data.turn;
        updateStatus();
        log(`> Board updated. Turn: ${currentTurn === uid ? "YOUR TURN" : "opponent"}`);
    }

    else if (msg.type === "game_end") {
        updateBoardUI(msg.data.board);
        endGame(msg.data.winner);
    }

    else if (msg.type === "chat") {
        addChatMessage(msg.from, msg.message, msg.from === uid);
    }

    else if (msg.type === "error") {
        log(`> ERROR: ${msg.message}`);
    }

    // ignore lobby_update on game page
};

// ── Cell clicks ───────────────────────────────────────────────────────────────
cells.forEach(cell => {
    cell.addEventListener("click", () => {
        if (gameOver) {
            log("> Game is over.");
            return;
        }
        if (currentTurn !== uid) {
            log("> Not your turn.");
            return;
        }
        if (cell.classList.contains("disabled")) {
            log("> Cell already taken.");
            return;
        }

        const position = parseInt(cell.getAttribute("data-index"));
        log(`> Sending move: position ${position}`);

        ws.send(JSON.stringify({
            type:     "move",
            room_id:  currentRoom,
            position: position
        }));
    });
});

// ── Chat ──────────────────────────────────────────────────────────────────────
function sendChat() {
    const text = chatInput.value.trim();
    if (!text || !currentRoom) return;
    ws.send(JSON.stringify({
        type:    "chat",
        room_id: currentRoom,
        message: text
    }));
    chatInput.value = "";
}
btnSendChat.onclick = sendChat;
chatInput.addEventListener("keydown", e => { if (e.key === "Enter") sendChat(); });

// ── Forfeit ───────────────────────────────────────────────────────────────────
btnForfeit.onclick = () => {
    if (gameOver) return;
    if (!confirm("Forfeit this match?")) return;
    ws.send(JSON.stringify({ type: "forfeit", room_id: currentRoom }));
    log("> You forfeited.");
};

// ── Clear log ─────────────────────────────────────────────────────────────────
btnClearLog.onclick = () => { logPanel.innerHTML = ""; };

// ── UI helpers ────────────────────────────────────────────────────────────────

function updateBoardUI(board) {
    board.forEach((symbol, i) => {
        cells[i].innerText = symbol || "";
        cells[i].classList.remove("symbol-x", "symbol-o");
        if (symbol) {
            cells[i].classList.add("disabled");
            cells[i].classList.add(symbol === "X" ? "symbol-x" : "symbol-o");
        }
    });
}

function updateStatus() {
    if (!mySymbol) {
        statusText.innerText = "WAITING FOR MATCH...";
        return;
    }
    statusText.innerText = currentTurn === uid
        ? ">> YOUR TURN <<"
        : "Waiting for opponent...";
}

function endGame(winnerUid) {
    gameOver    = true;
    currentTurn = "";
    cells.forEach(c => c.classList.add("disabled"));

    if (winnerUid === uid) {
        statusText.innerHTML = `<span style="color:var(--main-green);text-shadow:var(--glow)">VICTORY</span>`;
        log("> You won. ELO updated.");
    } else if (winnerUid === null) {
        statusText.innerText = "DRAW — STALEMATE";
        log("> Draw.");
    } else {
        statusText.innerHTML = `<span style="color:var(--alert-red)">DEFEAT</span>`;
        log("> You were defeated.");
    }

    setTimeout(() => {
        if (confirm("Return to lobby?")) {
            window.location.href = "/static/lobby.html";
        }
    }, 2000);
}

function resetBoard() {
    gameOver = false;
    cells.forEach(c => {
        c.innerText = "";
        c.classList.remove("disabled", "symbol-x", "symbol-o");
    });
}

function log(msg) {
    const p = document.createElement("p");
    p.innerText = msg;
    logPanel.appendChild(p);
    logPanel.scrollTop = logPanel.scrollHeight;
}

function addChatMessage(from, message, isMe) {
    const p = document.createElement("p");
    p.className = isMe ? "chat-me" : "chat-them";
    p.innerText = `${isMe ? "YOU" : from}: ${message}`;
    chatMessages.appendChild(p);
    chatMessages.scrollTop = chatMessages.scrollHeight;
}