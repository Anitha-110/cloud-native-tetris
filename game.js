"use strict";

/* =========================================================
   CANVAS
========================================================= */

const canvas = document.getElementById("gameCanvas");

if (!canvas) {
    throw new Error("gameCanvas element not found");
}

const ctx = canvas.getContext("2d");

if (!ctx) {
    throw new Error("Canvas 2D context is not supported");
}


/* =========================================================
   GAME SETTINGS
========================================================= */

const COLS = 10;
const ROWS = 20;
const BLOCK = 30;

canvas.width = COLS * BLOCK;
canvas.height = ROWS * BLOCK;

ctx.scale(BLOCK, BLOCK);


/* =========================================================
   COLORS
========================================================= */

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


/* =========================================================
   TETRIS PIECES
========================================================= */

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

const PIECE_NAMES = Object.keys(PIECES);


/* =========================================================
   GAME STATE
========================================================= */

let board = [];
let player = null;
let nextPiece = null;
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

let scoreSubmitted = false;


/* =========================================================
   LOCAL STORAGE
========================================================= */

let gamesPlayed = Number(
    localStorage.getItem("tetrisGames") || 0
);

let bestScore = Number(
    localStorage.getItem("tetrisBest") || 0
);

let username =
    localStorage.getItem("tetrisUsername") || "Anitha";

if (!username.trim()) {
    username = "Anitha";
    localStorage.setItem("tetrisUsername", username);
}


/* =========================================================
   HTML ELEMENTS
========================================================= */

const scoreElement =
    document.getElementById("score");

const levelElement =
    document.getElementById("level");

const linesElement =
    document.getElementById("lines");

const bestScoreElement =
    document.getElementById("bestScore");

const gamesPlayedElement =
    document.getElementById("gamesPlayed");

const finalScoreElement =
    document.getElementById("finalScore");

const gameOverOverlay =
    document.getElementById("gameOverOverlay");

const pauseOverlay =
    document.getElementById("pauseOverlay");

const matchStatus =
    document.getElementById("matchStatus");


/* =========================================================
   UPDATE UI
========================================================= */

function updateStats() {

    if (scoreElement) {
        scoreElement.textContent =
            score.toLocaleString();
    }

    if (levelElement) {
        levelElement.textContent =
            level;
    }

    if (linesElement) {
        linesElement.textContent =
            lines;
    }

    if (bestScoreElement) {
        bestScoreElement.textContent =
            Math.max(bestScore, score).toLocaleString();
    }

    if (gamesPlayedElement) {
        gamesPlayedElement.textContent =
            gamesPlayed;
    }
}


/* =========================================================
   CREATE BOARD
========================================================= */

function createBoard() {

    return Array.from(
        { length: ROWS },
        () => Array(COLS).fill(0)
    );
}


/* =========================================================
   RANDOM PIECE
========================================================= */

function randomPiece() {

    const type =
        PIECE_NAMES[
            Math.floor(
                Math.random() * PIECE_NAMES.length
            )
        ];

    return {
        type: type,

        matrix: PIECES[type].map(
            row => [...row]
        ),

        pos: {
            x: 0,
            y: 0
        }
    };
}


/* =========================================================
   RESET PLAYER
========================================================= */

function resetPlayer() {

    player =
        nextPiece || randomPiece();

    nextPiece =
        randomPiece();

    player.pos.y = 0;

    player.pos.x =
        Math.floor(COLS / 2) -
        Math.floor(player.matrix[0].length / 2);

    drawNextPiece();
}


/* =========================================================
   COLLISION
========================================================= */

function collide(arena, piece) {

    const matrix = piece.matrix;
    const pos = piece.pos;

    for (let y = 0; y < matrix.length; y++) {

        for (let x = 0; x < matrix[y].length; x++) {

            if (matrix[y][x] === 0) {
                continue;
            }

            const boardY = y + pos.y;
            const boardX = x + pos.x;

            if (
                boardY < 0 ||
                boardY >= ROWS ||
                boardX < 0 ||
                boardX >= COLS ||
                arena[boardY][boardX] !== 0
            ) {
                return true;
            }
        }
    }

    return false;
}


/* =========================================================
   MERGE PIECE
========================================================= */

function merge(arena, piece) {

    piece.matrix.forEach(
        (row, y) => {

            row.forEach(
                (value, x) => {

                    if (value !== 0) {

                        const boardY =
                            y + piece.pos.y;

                        const boardX =
                            x + piece.pos.x;

                        if (
                            boardY >= 0 &&
                            boardY < ROWS &&
                            boardX >= 0 &&
                            boardX < COLS
                        ) {
                            arena[boardY][boardX] =
                                value;
                        }
                    }
                }
            );
        }
    );
}


/* =========================================================
   ROTATE MATRIX
========================================================= */

function rotate(matrix, direction) {

    for (
        let y = 0;
        y < matrix.length;
        y++
    ) {

        for (
            let x = 0;
            x < y;
            x++
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

        matrix.forEach(
            row => row.reverse()
        );

    } else {

        matrix.reverse();
    }
}


/* =========================================================
   PLAYER ROTATE
========================================================= */

function playerRotate(direction) {

    if (
        gameOver ||
        paused ||
        !player
    ) {
        return;
    }

    const originalX =
        player.pos.x;

    let offset = 1;

    rotate(
        player.matrix,
        direction
    );

    while (
        collide(
            board,
            player
        )
    ) {

        player.pos.x += offset;

        offset =
            -(offset +
                (offset > 0 ? 1 : -1));

        if (
            Math.abs(offset) >
            player.matrix[0].length
        ) {

            rotate(
                player.matrix,
                -direction
            );

            player.pos.x =
                originalX;

            return;
        }
    }
}


/* =========================================================
   PLAYER MOVE
========================================================= */

function playerMove(direction) {

    if (
        gameOver ||
        paused ||
        !player
    ) {
        return;
    }

    player.pos.x += direction;

    if (
        collide(
            board,
            player
        )
    ) {
        player.pos.x -= direction;
    }
}


/* =========================================================
   PLAYER DROP
========================================================= */

function playerDrop() {

    if (
        gameOver ||
        paused ||
        !player
    ) {
        return;
    }

    player.pos.y++;

    if (
        collide(
            board,
            player
        )
    ) {

        player.pos.y--;

        merge(
            board,
            player
        );

        arenaSweep();

        resetPlayer();

        canHold = true;

        if (
            collide(
                board,
                player
            )
        ) {

            endGame();
        }
    }

    dropCounter = 0;
}


/* =========================================================
   HARD DROP
========================================================= */

function hardDrop() {

    if (
        gameOver ||
        paused ||
        !player
    ) {
        return;
    }

    while (
        !collide(
            board,
            player
        )
    ) {
        player.pos.y++;
    }

    player.pos.y--;

    merge(
        board,
        player
    );

    arenaSweep();

    resetPlayer();

    canHold = true;

    if (
        collide(
            board,
            player
        )
    ) {
        endGame();
    }

    dropCounter = 0;
}


/* =========================================================
   HOLD PIECE
========================================================= */

function playerHold() {

    if (
        !canHold ||
        gameOver ||
        paused ||
        !player
    ) {
        return;
    }

    const currentType =
        player.type;

    if (holdPiece === null) {

        holdPiece =
            currentType;

        resetPlayer();

    } else {

        const swapType =
            holdPiece;

        holdPiece =
            currentType;

        player = {
            type: swapType,

            matrix:
                PIECES[swapType].map(
                    row => [...row]
                ),

            pos: {
                x: 0,
                y: 0
            }
        };

        player.pos.x =
            Math.floor(COLS / 2) -
            Math.floor(
                player.matrix[0].length / 2
            );

        drawNextPiece();
    }

    canHold = false;

    drawHoldPiece();
}


/* =========================================================
   CLEAR LINES
========================================================= */

function arenaSweep() {

    let rowCount = 1;

    outer:

    for (
        let y = ROWS - 1;
        y >= 0;
        y--
    ) {

        for (
            let x = 0;
            x < COLS;
            x++
        ) {

            if (
                board[y][x] === 0
            ) {
                continue outer;
            }
        }

        board.splice(
            y,
            1
        );

        board.unshift(
            new Array(COLS).fill(0)
        );

        y++;

        lines++;

        score +=
            rowCount * 100;

        rowCount *= 2;
    }

    level =
        Math.floor(lines / 10) + 1;

    dropInterval =
        Math.max(
            100,
            800 - ((level - 1) * 65)
        );

    updateStats();
}


/* =========================================================
   DRAW MATRIX
========================================================= */

function drawMatrix(matrix, offset) {

    matrix.forEach(
        (row, y) => {

            row.forEach(
                (value, x) => {

                    if (value !== 0) {

                        drawBlock(
                            x + offset.x,
                            y + offset.y,
                            COLORS[value]
                        );
                    }
                }
            );
        }
    );
}


/* =========================================================
   DRAW BLOCK
========================================================= */

function drawBlock(x, y, color) {

    ctx.fillStyle = color;

    ctx.fillRect(
        x + 0.06,
        y + 0.06,
        0.88,
        0.88
    );

    ctx.fillStyle =
        "rgba(255,255,255,0.28)";

    ctx.fillRect(
        x + 0.12,
        y + 0.12,
        0.76,
        0.08
    );

    ctx.fillStyle =
        "rgba(0,0,0,0.25)";

    ctx.fillRect(
        x + 0.12,
        y + 0.82,
        0.76,
        0.05
    );
}


/* =========================================================
   DRAW GRID
========================================================= */

function drawGrid() {

    ctx.strokeStyle =
        "rgba(255,255,255,0.035)";

    ctx.lineWidth =
        0.025;

    for (
        let x = 0;
        x <= COLS;
        x++
    ) {

        ctx.beginPath();

        ctx.moveTo(
            x,
            0
        );

        ctx.lineTo(
            x,
            ROWS
        );

        ctx.stroke();
    }

    for (
        let y = 0;
        y <= ROWS;
        y++
    ) {

        ctx.beginPath();

        ctx.moveTo(
            0,
            y
        );

        ctx.lineTo(
            COLS,
            y
        );

        ctx.stroke();
    }
}


/* =========================================================
   DRAW GHOST
========================================================= */

function drawGhost() {

    if (!player) {
        return;
    }

    const ghost = {

        matrix:
            player.matrix,

        pos: {
            x: player.pos.x,
            y: player.pos.y
        }
    };

    while (
        !collide(
            board,
            ghost
        )
    ) {

        ghost.pos.y++;
    }

    ghost.pos.y--;

    ghost.matrix.forEach(
        (row, y) => {

            row.forEach(
                (value, x) => {

                    if (value !== 0) {

                        ctx.strokeStyle =
                            "rgba(255,255,255,0.16)";

                        ctx.lineWidth =
                            0.06;

                        ctx.strokeRect(
                            x +
                                ghost.pos.x +
                                0.12,

                            y +
                                ghost.pos.y +
                                0.12,

                            0.76,
                            0.76
                        );
                    }
                }
            );
        }
    );
}


/* =========================================================
   DRAW GAME
========================================================= */

function draw() {

    ctx.fillStyle =
        "#080c16";

    ctx.fillRect(
        0,
        0,
        COLS,
        ROWS
    );

    drawGrid();

    drawMatrix(
        board,
        {
            x: 0,
            y: 0
        }
    );

    if (
        player &&
        !gameOver
    ) {

        drawGhost();

        drawMatrix(
            player.matrix,
            player.pos
        );
    }
}


/* =========================================================
   PREVIEW
========================================================= */

function drawPreview(
    elementId,
    pieceType
) {

    const element =
        document.getElementById(
            elementId
        );

    if (!element) {
        return;
    }

    element.innerHTML = "";

    if (!pieceType) {

        element.innerHTML =
            '<span class="empty-message">NONE</span>';

        return;
    }

    const previewCanvas =
        document.createElement(
            "canvas"
        );

    previewCanvas.width = 100;
    previewCanvas.height = 100;

    previewCanvas.style.width =
        "100px";

    previewCanvas.style.height =
        "100px";

    element.appendChild(
        previewCanvas
    );

    const previewCtx =
        previewCanvas.getContext(
            "2d"
        );

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

    matrix.forEach(
        (row, y) => {

            row.forEach(
                (value, x) => {

                    if (value !== 0) {

                        previewCtx.fillStyle =
                            COLORS[value];

                        previewCtx.fillRect(
                            offsetX +
                                x * size +
                                2,

                            offsetY +
                                y * size +
                                2,

                            size - 4,
                            size - 4
                        );
                    }
                }
            );
        }
    );
}


/* =========================================================
   NEXT PIECE
========================================================= */

function drawNextPiece() {

    if (!nextPiece) {
        return;
    }

    drawPreview(
        "nextBoard",
        nextPiece.type
    );
}


/* =========================================================
   HOLD PIECE
========================================================= */

function drawHoldPiece() {

    drawPreview(
        "holdBoard",
        holdPiece
    );
}


/* =========================================================
   SUBMIT SCORE
========================================================= */

/*
   IMPORTANT:

   This URL is for local testing only.

   When your Flask backend is deployed online,
   change this to your real backend URL.

   Example:

   const API_BASE_URL =
       "https://your-backend-domain.com";
*/

const API_BASE_URL =
    "http://127.0.0.1:5000";


async function submitScoreToBackend() {

    if (scoreSubmitted) {
        return null;
    }

    scoreSubmitted = true;

    const payload = {

        username:
            username.trim() || "Anitha",

        score:
            Number(score),

        lines:
            Number(lines),

        level:
            Number(level)
    };

    console.log(
        "Submitting score:",
        payload
    );

    try {

        const response =
            await fetch(
                `${API_BASE_URL}/api/scores`,
                {
                    method: "POST",

                    headers: {
                        "Content-Type":
                            "application/json"
                    },

                    body:
                        JSON.stringify(
                            payload
                        )
                }
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Score submission failed"
            );
        }

        console.log(
            "Score saved:",
            data
        );

        return data;

    } catch (error) {

        console.error(
            "Leaderboard error:",
            error
        );

        scoreSubmitted = false;

        return null;
    }
}


/* =========================================================
   LOAD LEADERBOARD
========================================================= */

async function loadLeaderboard() {

    try {

        const response =
            await fetch(
                `${API_BASE_URL}/api/leaderboard`
            );

        const data =
            await response.json();

        if (!response.ok) {

            throw new Error(
                data.error ||
                "Leaderboard request failed"
            );
        }

        console.log(
            "Leaderboard:",
            data
        );

        return data;

    } catch (error) {

        console.error(
            "Could not load leaderboard:",
            error
        );

        return null;
    }
}


/* =========================================================
   GAME OVER
========================================================= */

async function endGame() {

    if (gameOver) {
        return;
    }

    gameOver = true;

    /*
       Send final score to Flask/MySQL.
    */

    await submitScoreToBackend();

    gamesPlayed++;

    localStorage.setItem(
        "tetrisGames",
        gamesPlayed
    );

    if (score > bestScore) {

        bestScore =
            score;

        localStorage.setItem(
            "tetrisBest",
            bestScore
        );
    }

    updateStats();

    if (finalScoreElement) {

        finalScoreElement.textContent =
            score.toLocaleString();
    }

    if (gameOverOverlay) {

        gameOverOverlay.classList.remove(
            "hidden"
        );
    }

    if (matchStatus) {

        matchStatus.textContent =
            "GAME OVER";
    }

    await loadLeaderboard();
}


/* =========================================================
   RESTART GAME
========================================================= */

function restartGame() {

    board =
        createBoard();

    score = 0;
    level = 1;
    lines = 0;

    dropCounter = 0;
    dropInterval = 800;

    holdPiece = null;
    canHold = true;

    paused = false;
    gameOver = false;

    scoreSubmitted = false;

    nextPiece =
        randomPiece();

    resetPlayer();

    drawHoldPiece();

    updateStats();

    if (gameOverOverlay) {

        gameOverOverlay.classList.add(
            "hidden"
        );
    }

    if (pauseOverlay) {

        pauseOverlay.classList.add(
            "hidden"
        );
    }

    if (matchStatus) {

        matchStatus.textContent =
            "PLAYING";
    }
}


/* =========================================================
   PAUSE
========================================================= */

function togglePause() {

    if (gameOver) {
        return;
    }

    paused =
        !paused;

    if (pauseOverlay) {

        pauseOverlay.classList.toggle(
            "hidden",
            !paused
        );
    }

    if (matchStatus) {

        matchStatus.textContent =
            paused
                ? "PAUSED"
                : "PLAYING";
    }
}


/* =========================================================
   GAME LOOP
========================================================= */

function update(time = 0) {

    const deltaTime =
        time - lastTime;

    lastTime =
        time;

    if (
        !paused &&
        !gameOver &&
        player
    ) {

        dropCounter +=
            deltaTime;

        if (
            dropCounter >
            dropInterval
        ) {

            playerDrop();
        }
    }

    draw();

    requestAnimationFrame(
        update
    );
}


/* =========================================================
   KEYBOARD CONTROLS
========================================================= */

document.addEventListener(
    "keydown",
    event => {

        if (
            event.key ===
            "ArrowLeft"
        ) {

            event.preventDefault();

            playerMove(-1);
        }

        else if (
            event.key ===
            "ArrowRight"
        ) {

            event.preventDefault();

            playerMove(1);
        }

        else if (
            event.key ===
            "ArrowDown"
        ) {

            event.preventDefault();

            playerDrop();
        }

        else if (
            event.key ===
            "ArrowUp"
        ) {

            event.preventDefault();

            playerRotate(1);
        }

        else if (
            event.code ===
            "Space"
        ) {

            event.preventDefault();

            hardDrop();
        }

        else if (
            event.key.toLowerCase() ===
            "c"
        ) {

            event.preventDefault();

            playerHold();
        }

        else if (
            event.key.toLowerCase() ===
            "p"
        ) {

            event.preventDefault();

            togglePause();
        }
    }
);


/* =========================================================
   BUTTON HELPER
========================================================= */

function addClickListener(
    elementId,
    callback
) {

    const element =
        document.getElementById(
            elementId
        );

    if (element) {

        element.addEventListener(
            "click",
            callback
        );
    }
}


/* =========================================================
   BUTTONS
========================================================= */

addClickListener(
    "pauseBtn",
    togglePause
);

addClickListener(
    "resumeBtn",
    togglePause
);

addClickListener(
    "newGameBtn",
    restartGame
);

addClickListener(
    "restartBtn",
    restartGame
);


/* =========================================================
   SOUND BUTTON
========================================================= */

addClickListener(
    "soundBtn",
    function () {

        const button =
            document.getElementById(
                "soundBtn"
            );

        if (!button) {
            return;
        }

        button.textContent =
            button.textContent === "🔊"
                ? "🔇"
                : "🔊";
    }
);


/* =========================================================
   MOBILE CONTROLS
========================================================= */

document
    .querySelectorAll(
        ".mobile-controls button"
    )
    .forEach(
        button => {

            button.addEventListener(
                "click",
                () => {

                    const action =
                        button.dataset.action;

                    switch (action) {

                        case "left":
                            playerMove(-1);
                            break;

                        case "right":
                            playerMove(1);
                            break;

                        case "down":
                            playerDrop();
                            break;

                        case "rotate":
                            playerRotate(1);
                            break;

                        case "drop":
                            hardDrop();
                            break;

                        case "hold":
                            playerHold();
                            break;

                        default:
                            console.warn(
                                "Unknown control:",
                                action
                            );
                    }
                }
            );
        }
    );


/* =========================================================
   START GAME
========================================================= */

restartGame();

requestAnimationFrame(
    update
);