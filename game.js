// ==========================================
// 1. GAME STATE VARIABLES
// ==========================================
// In a real application, myUid would be provided by your login/auth system.
let myUid = "player_123"; 
let mySymbol = "";      // "X" or "O"
let currentTurn = "";   // UID of the player whose turn it currently is
let roomId = "";        // The active game room ID
let socket = null;      // The WebSocket connection

// ==========================================
// 2. DOM ELEMENTS
// ==========================================
const boardElement = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const statusText = document.getElementById('game-status');
const logPanel = document.getElementById('log-panel');
const uidDisplay = document.getElementById('player-uid');
const eloDisplay = document.getElementById('player-elo');

// ==========================================
// 3. WEBSOCKET CONNECTION (BACKEND INTEGRATION)
// ==========================================
function connectToServer() {
    log("> Connecting to main server...");
    
    // TODO: Replace with your actual backend WebSocket URL
    // socket = new WebSocket("ws://your-backend-url/ws/" + myUid);
    
    // socket.onopen = () => {
    //     log("> Connection established.");
    // };

    // socket.onmessage = (event) => {
    //     const message = JSON.parse(event.data);
    //     handleServerMessage(message);
    // };

    // socket.onerror = (error) => {
    //     log("> ERROR: Connection failed.");
    // };
}

// ==========================================
// 4. HANDLING MESSAGES FROM PYTHON BACKEND
// ==========================================
// This function parses the dictionaries sent by your Python `GameManager`
function handleServerMessage(message) {
    const type = message.type;
    const data = message.data;

    // Triggered by backend: await self.send_game_start(game)
    if (type === "game_start") {
        roomId = data.room_id;
        mySymbol = data.symbol;
        currentTurn = data.turn;
        
        uidDisplay.innerText = myUid;
        log(`> Match found. Room: ${roomId}`);
        log(`> You are assigned [ ${mySymbol} ]`);
        
        resetBoardUI();
        updateTurnStatusText();
    } 
    
    // Triggered by backend: await self.send_game_update(game)
    else if (type === "game_update") {
        updateBoardUI(data.board);
        currentTurn = data.turn;
        updateTurnStatusText();
    } 
    
    // Triggered by backend: await self.send_game_end(game, winner_uid)
    else if (type === "game_end") {
        updateBoardUI(data.board);
        handleGameEnd(data.winner);
    }
}

// ==========================================
// 5. USER INTERACTION (CLICKING THE BOARD)
// ==========================================
cells.forEach(cell => {
    cell.addEventListener('click', (event) => {
        const index = event.target.getAttribute('data-index');
        
        // Block the click if it's not our turn, or if the cell already has an X or O
        if (currentTurn !== myUid || event.target.innerText !== "") {
            return; 
        }

        log(`> Sending move: Position ${index}`);
        
        // --- SEND MOVE TO PYTHON BACKEND ---
        /*
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(JSON.stringify({
                action: "move",
                room_id: roomId,
                position: parseInt(index)
            }));
        }
        */

        // For frontend testing only:
        mockBackendResponse(parseInt(index));
    });
});

// ==========================================
// 6. UI UPDATE FUNCTIONS
// ==========================================
function updateBoardUI(boardArray) {
    // Your backend sends a list like ["X", None, "O", ...]
    // We map that list directly to our HTML grid.
    boardArray.forEach((symbol, index) => {
        cells[index].innerText = symbol ? symbol : "";
        if (symbol) {
            cells[index].classList.add('disabled');
        }
    });
}

function updateTurnStatusText() {
    if (currentTurn === myUid) {
        statusText.innerText = ">> YOUR TURN <<";
        statusText.style.color = "var(--main-green)";
    } else {
        statusText.innerText = "Waiting for opponent...";
        statusText.style.color = "var(--main-green)";
    }
}

function handleGameEnd(winnerUid) {
    if (winnerUid === myUid) {
        statusText.innerHTML = `<span style="color: var(--main-green);">VICTORY! ELO updated.</span>`;
        log("> Target destroyed. You win.");
    } else if (winnerUid === null) {
        statusText.innerText = "DRAW!";
        log("> Stalemate. No winner.");
    } else {
        statusText.innerHTML = `<span style="color: var(--alert-red);">DEFEAT.</span>`;
        log("> You have been defeated.");
    }
    
    // Freeze the board so no more moves can be made
    cells.forEach(cell => cell.classList.add('disabled'));
    currentTurn = ""; 
}

function resetBoardUI() {
    cells.forEach(cell => {
        cell.innerText = "";
        cell.classList.remove('disabled');
    });
}

// ==========================================
// 7. UTILITY FUNCTIONS (Logs)
// ==========================================
function log(message) {
    const paragraph = document.createElement('p');
    paragraph.innerText = message;
    logPanel.appendChild(paragraph);
    // Auto-scroll to the bottom of the log panel
    logPanel.scrollTop = logPanel.scrollHeight;
}

function clearLog() {
    logPanel.innerHTML = "";
}

// ==========================================
// 8. MOCK FUNCTIONS (FOR TESTING WITHOUT PYTHON)
// ==========================================
// Everything below this line is just to let you test the UI visually.
// You can delete this section once your WebSocket is hooked up.

let mockBoard = Array(9).fill(null);

function mockConnect() {
    eloDisplay.innerText = "1250";
    
    // Simulate receiving a "game_start" dictionary from Python
    handleServerMessage({
        type: "game_start",
        data: { room_id: "ROOM_77", symbol: "X", turn: myUid }
    });
    
    mockBoard = Array(9).fill(null);
}

function mockBackendResponse(clickedIndex) {
    // 1. Simulate the user's move being accepted
    mockBoard[clickedIndex] = "X"; 
    handleServerMessage({
        type: "game_update",
        data: { board: mockBoard, turn: "opponent_456" }
    });

    // 2. Simulate the opponent making a move 1 second later
    setTimeout(() => {
        // Find empty spots
        let emptySpaces = mockBoard.map((val, i) => val === null ? i : null).filter(val => val !== null);
        
        if(emptySpaces.length > 0) {
            // Pick a random empty spot for the opponent (O)
            let randomPos = emptySpaces[Math.floor(Math.random() * emptySpaces.length)];
            mockBoard[randomPos] = "O";
            
            // Send the update back to the UI
            handleServerMessage({
                type: "game_update",
                data: { board: mockBoard, turn: myUid }
            });
        }
    }, 1000);
}