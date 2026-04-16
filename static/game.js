
let myUid = "player_123"; 
let mySymbol = "";    
let currentTurn = ""; 
let roomId = "";       
let socket = null;     
const boardElement = document.getElementById('board');
const cells = document.querySelectorAll('.cell');
const statusText = document.getElementById('game-status');
const logPanel = document.getElementById('log-panel');
const uidDisplay = document.getElementById('player-uid');
const eloDisplay = document.getElementById('player-elo');

function connectToServer() {
    log("> Connecting to main server...");
}

function handleServerMessage(message) {
    const type = message.type;
    const data = message.data;
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
    else if (type === "game_update") {
        updateBoardUI(data.board);
        currentTurn = data.turn;
        updateTurnStatusText();
    } 
    else if (type === "game_end") {
        updateBoardUI(data.board);
        handleGameEnd(data.winner);
    }
}
    function checkWinner(board) {
    const winPatterns = [
        [0,1,2], [3,4,5], [6,7,8], // rows
        [0,3,6], [1,4,7], [2,5,8], // cols
        [0,4,8], [2,4,6]           // diagonals
    ];

    for (let pattern of winPatterns) {
        const [a, b, c] = pattern;
        if (board[a] && board[a] === board[b] && board[a] === board[c]) {
            return board[a]; // returns "X" or "O"
        }
    }

    if (board.every(cell => cell !== null)) {
        return "DRAW";
    }

    return null;
}

cells.forEach(cell => {
    cell.addEventListener('click', (event) => {
        const index = event.target.getAttribute('data-index');
        if (currentTurn !== myUid || event.target.innerText !== "") {
            return; 
        }

        log(`> Sending move: Position ${index}`);
        

        mockBackendResponse(parseInt(index));
    });
});

function updateBoardUI(boardArray) {
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
function log(message) {
    const paragraph = document.createElement('p');
    paragraph.innerText = message;
    logPanel.appendChild(paragraph);

    logPanel.scrollTop = logPanel.scrollHeight;
}

function clearLog() {
    logPanel.innerHTML = "";
}

let mockBoard = Array(9).fill(null);

function mockConnect() {
    eloDisplay.innerText = "1250";
    
    handleServerMessage({
        type: "game_start",
        data: { room_id: "ROOM_77", symbol: "X", turn: myUid }
    });
    
    mockBoard = Array(9).fill(null);
}

function mockBackendResponse(clickedIndex) {
    mockBoard[clickedIndex] = "X"; 

    let result = checkWinner(mockBoard);

    if (result) {
        handleServerMessage({
            type: "game_end",
            data: {
                board: mockBoard,
                winner: result === "DRAW" ? null : (result === "X" ? myUid : "opponent_456")
            }
        });
        return;
    }

    handleServerMessage({
        type: "game_update",
        data: { board: mockBoard, turn: "opponent_456" }
    });

    setTimeout(() => {
        let emptySpaces = mockBoard
            .map((val, i) => val === null ? i : null)
            .filter(val => val !== null);

        if (emptySpaces.length > 0) {
            let randomPos = emptySpaces[Math.floor(Math.random() * emptySpaces.length)];
            mockBoard[randomPos] = "O";

            let result = checkWinner(mockBoard);

            if (result) {
                handleServerMessage({
                    type: "game_end",
                    data: {
                        board: mockBoard,
                        winner: result === "DRAW" ? null : (result === "O" ? "opponent_456" : myUid)
                    }
                });
                return;
            }

            handleServerMessage({
                type: "game_update",
                data: { board: mockBoard, turn: myUid }
            });
        }
    }, 1000);
}