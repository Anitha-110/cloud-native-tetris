USE tetris_db;

INSERT INTO players (username)
VALUES
    ('Anitha'),
    ('PlayerOne'),
    ('PlayerTwo')
ON DUPLICATE KEY UPDATE username = VALUES(username);

INSERT INTO scores (player_id, score, lines, level)
SELECT id, 12500, 35, 4
FROM players
WHERE username = 'Anitha';

INSERT INTO scores (player_id, score, lines, level)
SELECT id, 9800, 28, 3
FROM players
WHERE username = 'PlayerOne';

INSERT INTO scores (player_id, score, lines, level)
SELECT id, 7500, 21, 2
FROM players
WHERE username = 'PlayerTwo';
