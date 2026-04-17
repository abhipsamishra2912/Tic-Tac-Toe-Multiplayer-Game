const uid    = localStorage.getItem("uid");
const roomId = new URLSearchParams(window.location.search).get("room")
            || localStorage.getItem("room_id");

if (!uid || !roomId) {
    window.location.href = "/static/lobby.html";
}

// DOM
const cells         = document.querySelectorAll(".cell");
const statusText    = document.getElementById("game-status");
const logPanel      = document.getElementById("log-panel");
const playerUidEl   = document.getElementById("player-uid");
const playerSymbolEl = document.getElementById("player-symbol");
const playerEloEl   = document.getElementById("player-elo");
const roomIdEl      = document.getElementById("room-id");
const opponentEl    = document.getElementById("opponent-uid");
const chatMessages  = document.getElementById("chat-messages");
const chatInput     = document.getElementById("chat-input");
const btnSendChat   = document.getElementById("btn-send-chat");
const btnForfeit    = document.getElementById("btn-forfeit");
const btnClearLog   = document.getElementById("btn-clear-log");

// State
let mySymbol    = "";
let currentTurn = "";
let gameOver    = false;
let opponentUid = "";

// Set static info
playerUidEl.innerText = uid;
roomIdEl.innerText    = roomId || "---";

// WebSocket
const ws = new WebSocket(`ws://${window.location.host}/ws/${uid}`);

ws.onopen = () => {
    log("> Connection established.");
    statusText.innerText = "CONNECTED — WAITING FOR GAME DATA...";
};

ws.onclose = () => {
    log("> Connection lost.");
    statusText.innerText = "DISCONNECTED";
};

ws.onerror = () => {
    log("> Connection error.");
};

ws.onmessage = (event) => {
    const msg = JSON.parse(event.data);

    if (msg.type === "game_start") {
        mySymbol    = msg.data.symbol;
        currentTurn = msg.data.turn;
        opponentUid = msg.data.symbol === "X" ? msg.data.turn : uid;

        // figure out opponent — whoever isn't us
        playerSymbolEl.innerText = mySymbol;
        roomIdEl.innerText       = msg.data.room_id;

        log(`> Match started. Room: ${msg.data.room_id}`);
        log(`> You are [ ${mySymbol} ]`);

        resetBoard();
        updateStatus();
    }

    if (msg.type === "game_update") {
        updateBoardUI(msg.data.board);
        currentTurn = msg.data.turn;
        updateStatus();
    }

    if (msg.type === "game_end") {
        updateBoardUI(msg.data.board);
        endGame(msg.data.winner);
    }

    if (msg.type === "chat") {
        const isMe = msg.from === uid;
        addChatMessage(msg.from, msg.message, isMe);
    }

    if (msg.type === "error") {
        log(`> ERROR: ${msg.message}`);
    }
};

// Cell clicks
cells.forEach(cell => {
    cell.addEventListener("click", () => {
        if (gameOver) return;
        if (currentTurn !== uid) return;
        if (cell.classList.contains("disabled")) return;

        const index = parseInt(cell.getAttribute("data-index"));
        log(`> Sending move: position ${index}`);

        ws.send(JSON.stringify({
            type: "move",
            room_id: roomId,
            position: index
        }));
    });
});

// Chat
btnSendChat.onclick = sendChat;
chatInput.addEventListener("keydown", (e) => {
    if (e.key === "Enter") sendChat();
});

function sendChat() {
    const msg = chatInput.value.trim();
    if (!msg || !roomId) return;

    ws.send(JSON.stringify({
        type: "chat",
        room_id: roomId,
        message: msg
    }));

    chatInput.value = "";
}

// Forfeit
btnForfeit.onclick = () => {
    if (gameOver) return;
    if (!confirm("Forfeit this match?")) return;
    ws.send(JSON.stringify({
        type: "forfeit",
        room_id: roomId
    }));
    log("> You forfeited.");
};

// Clear log
btnClearLog.onclick = () => { logPanel.innerHTML = ""; };

// UI helpers
function updateBoardUI(board) {
    board.forEach((symbol, i) => {
        cells[i].innerText = symbol || "";
        if (symbol) {
            cells[i].classList.add("disabled");
            cells[i].classList.remove("symbol-x", "symbol-o");
            cells[i].classList.add(symbol === "X" ? "symbol-x" : "symbol-o");
        }
    });
}

function updateStatus() {
    if (currentTurn === uid) {
        statusText.innerText  = ">> YOUR TURN <<";
    } else {
        statusText.innerText = "Waiting for opponent...";
    }
}

function endGame(winnerUid) {
    gameOver    = true;
    currentTurn = "";

    cells.forEach(c => c.classList.add("disabled"));

    if (winnerUid === uid) {
        statusText.innerHTML = `<span style="color:var(--main-green);text-shadow:var(--glow);">VICTORY</span>`;
        log("> You won. ELO updated.");
    } else if (winnerUid === null) {
        statusText.innerText = "DRAW — STALEMATE";
        log("> Draw. No winner.");
    } else {
        statusText.innerHTML = `<span style="color:var(--alert-red);">DEFEAT</span>`;
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