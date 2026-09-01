const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

ctx.scale(BLOCK, BLOCK);

const COLORS = [
    null,
    "#00e5ff",
    "#2979ff",
    "#ff9800",
    "#ffeb3b",
    "#31e981",
    "#9c4dff",
    "#ff3d71"
];

const PIECES = {
    I: [
        [0, 0, 0, 0],
        [1, 1, 1, 1],
        [0, 0, 0, 0],
        [0, 0, 0, 0]
    ],

    J: [
        [2, 0, 0],
        [2, 2, 2],
        [0, 0, 0]
    ],

    L: [
        [0, 0, 3],
        [3, 3, 3],
        [0, 0, 0]
    ],

    O: [
        [4, 4],
        [4, 4]
    ],

    S: [
        [0, 5, 5],
        [5, 5, 0],
        [0, 0, 0]
    ],

    T: [
        [0, 6, 0],
        [6, 6, 6],
        [0, 0, 0]
    ],

    Z: [
        [7, 7, 0],
        [0, 7, 7],
        [0, 0, 0]
    ]
};

const pieceNames = Object.keys(PIECES);

let board;
let player;
let nextPiece;
let holdPiece = null;
let canHold = true;

let score = 0;
let level = 1;
let lines = 0;

let dropCounter = 0;
let lastTime = 0;
let dropInterval = 800;

let paused = false;
let gameOver = false;

let gamesPlayed = Number(localStorage.getItem("tetrisGames") || 0);
let bestScore = Number(localStorage.getItem("tetrisBest") || 0);

document.getElementById("bestScore").textContent = bestScore;
document.getElementById("gamesPlayed").textContent = gamesPlayed;


function createBoard() {
    return Array.from(
        { length: ROWS },
        () => Array(COLS).fill(0)
    );
}


function randomPiece() {
    const name = pieceNames[
        Math.floor(Math.random() * pieceNames.length)
    ];

    return {
        type: name,
        matrix: PIECES[name].map(row => [...row]),
        pos: {
            x: 0,
            y: 0
        }
    };
}


function resetPlayer() {

    player = nextPiece || randomPiece();

    nextPiece = randomPiece();

    player.pos.y = 0;
    player.pos.x =
        Math.floor(COLS / 2) -
        Math.floor(player.matrix[0].length / 2);

    drawNextPiece();
}


function collide(arena, p) {

    const matrix = p.matrix;
    const pos = p.pos;

    for (let y = 0; y < matrix.length; ++y) {

        for (let x = 0; x < matrix[y].length; ++x) {

            if (
                matrix[y][x] !== 0 &&
                (
                    arena[y + pos.y] === undefined ||
                    arena[y + pos.y][x + pos.x] === undefined ||
                    arena[y + pos.y][x + pos.x] !== 0
                )
            ) {
                return true;
            }
        }
    }

    return false;
}


function merge(arena, p) {

    p.matrix.forEach((row, y) => {

        row.forEach((value, x) => {

            if (value !== 0) {
                arena[y + p.pos.y][x + p.pos.x] = value;
            }

        });

    });
}


function rotate(matrix, direction) {

    for (
        let y = 0;
        y < matrix.length;
        ++y
    ) {

        for (
            let x = 0;
            x < y;
            ++x
        ) {

            [
                matrix[x][y],
                matrix[y][x]
            ] = [
                matrix[y][x],
                matrix[x][y]
            ];

        }
    }

    if (direction > 0) {
        matrix.forEach(row => row.reverse());
    } else {
        matrix.reverse();
    }
}


function playerRotate(direction) {

    const originalX = player.pos.x;
    let offset = 1;

    rotate(player.matrix, direction);

    while (collide(board, player)) {

        player.pos.x += offset;

        offset = -(offset + (offset > 0 ? 1 : -1));

        if (offset > player.matrix[0].length) {

            rotate(player.matrix, -direction);
            player.pos.x = originalX;

            return;
        }
    }
}


function playerMove(direction) {

    player.pos.x += direction;

    if (collide(board, player)) {
        player.pos.x -= direction;
    }
}


function playerDrop() {

    player.pos.y++;

    if (collide(board, player)) {

        player.pos.y--;

        merge(board, player);

        arenaSweep();

        resetPlayer();

        canHold = true;

        if (collide(board, player)) {
            endGame();
        }
    }

    dropCounter = 0;
}


function hardDrop() {

    while (!collide(board, player)) {
        player.pos.y++;
    }

    player.pos.y--;

    merge(board, player);

    arenaSweep();

    resetPlayer();

    canHold = true;

    if (collide(board, player)) {
        endGame();
    }

    dropCounter = 0;
}


function playerHold() {

    if (!canHold || gameOver) {
        return;
    }

    const current = player.type;

    if (holdPiece === null) {

        holdPiece = current;
        resetPlayer();

    } else {

        const swap = holdPiece;

        holdPiece = current;

        player = {
            type: swap,
            matrix: PIECES[swap].map(row => [...row]),
            pos: {
                x: 0,
                y: 0
            }
        };

        player.pos.x =
            Math.floor(COLS / 2) -
            Math.floor(player.matrix[0].length / 2);

        drawNextPiece();
    }

    canHold = false;
    drawHoldPiece();
}


function arenaSweep() {

    let rowCount = 1;

    outer:
    for (let y = board.length - 1; y >= 0; --y) {

        for (let x = 0; x < board[y].length; ++x) {

            if (board[y][x] === 0) {
                continue outer;
            }
        }

        board.splice(y, 1);

        board.unshift(
            new Array(COLS).fill(0)
        );

        y++;

        lines++;
        score += rowCount * 100;

        rowCount *= 2;
    }

    level = Math.floor(lines / 10) + 1;

    dropInterval = Math.max(
        100,
        800 - ((level - 1) * 65)
    );

    updateStats();
}


function drawMatrix(matrix, offset) {

    matrix.forEach((row, y) => {

        row.forEach((value, x) => {

            if (value !== 0) {

                drawBlock(
                    x + offset.x,
                    y + offset.y,
                    COLORS[value]
                );

            }
        });
    });
}


function drawBlock(x, y, color) {

    ctx.fillStyle = color;

    ctx.fillRect(
        x + 0.06,
        y + 0.06,
        0.88,
        0.88
    );

    ctx.fillStyle = "rgba(255,255,255,0.28)";

    ctx.fillRect(
        x + 0.12,
        y + 0.12,
        0.76,
        0.08
    );

    ctx.fillStyle = "rgba(0,0,0,0.25)";

    ctx.fillRect(
        x + 0.12,
        y + 0.82,
        0.76,
        0.05
    );
}


function drawGrid() {

    ctx.strokeStyle = "rgba(255,255,255,0.035)";
    ctx.lineWidth = 0.025;

    for (let x = 0; x <= COLS; x++) {

        ctx.beginPath();
        ctx.moveTo(x, 0);
        ctx.lineTo(x, ROWS);
        ctx.stroke();

    }

    for (let y = 0; y <= ROWS; y++) {

        ctx.beginPath();
        ctx.moveTo(0, y);
        ctx.lineTo(COLS, y);
        ctx.stroke();

    }
}


function drawGhost() {

    const ghost = {
        matrix: player.matrix,
        pos: {
            x: player.pos.x,
            y: player.pos.y
        }
    };

    while (!collide(board, ghost)) {
        ghost.pos.y++;
    }

    ghost.pos.y--;

    ghost.matrix.forEach((row, y) => {

        row.forEach((value, x) => {

            if (value !== 0) {

                ctx.strokeStyle =
                    "rgba(255,255,255,0.16)";

                ctx.lineWidth = 0.06;

                ctx.strokeRect(
                    x + ghost.pos.x + 0.12,
                    y + ghost.pos.y + 0.12,
                    0.76,
                    0.76
                );
            }
        });
    });
}


function draw() {

    ctx.fillStyle = "#080c16";

    ctx.fillRect(
        0,
        0,
        COLS,
        ROWS
    );

    drawGrid();

    drawMatrix(board, {
        x: 0,
        y: 0
    });

    if (!gameOver) {
        drawGhost();
        drawMatrix(player.matrix, player.pos);
    }
}


function drawPreview(elementId, pieceType) {

    const element = document.getElementById(elementId);

    element.innerHTML = "";

    if (!pieceType) {

        element.innerHTML =
            '<span class="empty-message">NONE</span>';

        return;
    }

    const canvasPreview =
        document.createElement("canvas");

    canvasPreview.width = 100;
    canvasPreview.height = 100;

    canvasPreview.style.width = "100px";
    canvasPreview.style.height = "100px";

    element.appendChild(canvasPreview);

    const previewCtx =
        canvasPreview.getContext("2d");

    const matrix =
        PIECES[pieceType];

    const size = 24;

    const width =
        matrix[0].length * size;

    const height =
        matrix.length * size;

    const offsetX =
        (100 - width) / 2;

    const offsetY =
        (100 - height) / 2;

    matrix.forEach((row, y) => {

        row.forEach((value, x) => {

            if (value !== 0) {

                previewCtx.fillStyle =
                    COLORS[value];

                previewCtx.fillRect(
                    offsetX + x * size + 2,
                    offsetY + y * size + 2,
                    size - 4,
                    size - 4
                );

            }
        });

    });
}


function drawNextPiece() {
    drawPreview("nextBoard", nextPiece.type);
}


function drawHoldPiece() {
    drawPreview("holdBoard", holdPiece);
}


function updateStats() {

    document.getElementById("score").textContent =
        score.toLocaleString();

    document.getElementById("level").textContent =
        level;

    document.getElementById("lines").textContent =
        lines;

    document.getElementById("bestScore").textContent =
        Math.max(bestScore, score).toLocaleString();
}


function endGame() {

    gameOver = true;

    gamesPlayed++;

    localStorage.setItem(
        "tetrisGames",
        gamesPlayed
    );

    if (score > bestScore) {

        bestScore = score;

        localStorage.setItem(
            "tetrisBest",
            bestScore
        );
    }

    document.getElementById("gamesPlayed").textContent =
        gamesPlayed;

    document.getElementById("finalScore").textContent =
        score.toLocaleString();

    document
        .getElementById("gameOverOverlay")
        .classList.remove("hidden");

    document.getElementById("matchStatus").textContent =
        "GAME OVER";
}


function restartGame() {

    board = createBoard();

    score = 0;
    level = 1;
    lines = 0;

    dropCounter = 0;
    dropInterval = 800;

    holdPiece = null;
    canHold = true;

    paused = false;
    gameOver = false;

    nextPiece = randomPiece();

    resetPlayer();

    drawHoldPiece();

    updateStats();

    document
        .getElementById("gameOverOverlay")
        .classList.add("hidden");

    document
        .getElementById("pauseOverlay")
        .classList.add("hidden");

    document.getElementById("matchStatus").textContent =
        "PLAYING";
}


function togglePause() {

    if (gameOver) {
        return;
    }

    paused = !paused;

    document
        .getElementById("pauseOverlay")
        .classList.toggle(
            "hidden",
            !paused
        );

    document.getElementById("matchStatus").textContent =
        paused ? "PAUSED" : "PLAYING";
}


function update(time = 0) {

    const deltaTime =
        time - lastTime;

    lastTime = time;

    if (!paused && !gameOver) {

        dropCounter += deltaTime;

        if (dropCounter > dropInterval) {
            playerDrop();
        }
    }

    draw();

    requestAnimationFrame(update);
}


document.addEventListener("keydown", event => {

    if (event.key === "ArrowLeft") {
        playerMove(-1);
    }

    else if (event.key === "ArrowRight") {
        playerMove(1);
    }

    else if (event.key === "ArrowDown") {
        playerDrop();
    }

    else if (event.key === "ArrowUp") {
        playerRotate(1);
    }

    else if (event.code === "Space") {

        event.preventDefault();
        hardDrop();

    }

    else if (
        event.key.toLowerCase() === "c"
    ) {

        playerHold();

    }

    else if (
        event.key.toLowerCase() === "p"
    ) {

        togglePause();

    }

});


document
    .getElementById("pauseBtn")
    .addEventListener(
        "click",
        togglePause
    );


document
    .getElementById("resumeBtn")
    .addEventListener(
        "click",
        togglePause
    );


document
    .getElementById("newGameBtn")
    .addEventListener(
        "click",
        restartGame
    );


document
    .getElementById("restartBtn")
    .addEventListener(
        "click",
        restartGame
    );


document
    .getElementById("soundBtn")
    .addEventListener("click", function () {

        this.textContent =
            this.textContent === "🔊"
                ? "🔇"
                : "🔊";

    });


document
    .querySelectorAll(".mobile-controls button")
    .forEach(button => {

        button.addEventListener(
            "click",
            () => {

                const action =
                    button.dataset.action;

                if (action === "left") {
                    playerMove(-1);
                }

                if (action === "right") {
                    playerMove(1);
                }

                if (action === "down") {
                    playerDrop();
                }

                if (action === "rotate") {
                    playerRotate(1);
                }

                if (action === "drop") {
                    hardDrop();
                }

            }
        );

    });


restartGame();

requestAnimationFrame(update);
