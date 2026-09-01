CREATE DATABASE IF NOT EXISTS tetris_db
CHARACTER SET utf8mb4
COLLATE utf8mb4_unicode_ci;

CREATE USER IF NOT EXISTS 'tetris_user'@'localhost'
IDENTIFIED BY 'tetris_password';

GRANT ALL PRIVILEGES ON tetris_db.*
TO 'tetris_user'@'localhost';

FLUSH PRIVILEGES;

USE tetris_db;

CREATE TABLE IF NOT EXISTS players (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS scores (
    id INT AUTO_INCREMENT PRIMARY KEY,
    player_id INT NOT NULL,
    score INT NOT NULL,
    lines INT NOT NULL DEFAULT 0,
    level INT NOT NULL DEFAULT 1,
    created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT fk_scores_player
        FOREIGN KEY (player_id)
        REFERENCES players(id)
        ON DELETE CASCADE,

    INDEX idx_score (score),
    INDEX idx_player_id (player_id)
);
