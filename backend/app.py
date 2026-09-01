from flask import Flask, jsonify, request
from sqlalchemy import desc

from config import Config
from models import db, Player, Score


app = Flask(__name__)
app.config.from_object(Config)

db.init_app(app)


@app.route("/")
def home():
    return jsonify({
        "application": "Cloud-Native Tetris Gaming Platform",
        "status": "running",
        "version": "1.0.0"
    })


@app.route("/health")
def health():
    try:
        db.session.execute(db.text("SELECT 1"))

        return jsonify({
            "status": "healthy",
            "database": "connected"
        }), 200

    except Exception as error:
        return jsonify({
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(error)
        }), 503


@app.route("/api")
def api_status():
    return jsonify({
        "message": "Tetris API is running"
    })


@app.route("/api/scores", methods=["POST"])
def submit_score():

    data = request.get_json(silent=True) or {}

    username = str(data.get("username", "")).strip()
    score = data.get("score")
    lines = data.get("lines", 0)
    level = data.get("level", 1)

    if not username:
        return jsonify({
            "error": "Username is required"
        }), 400

    if score is None:
        return jsonify({
            "error": "Score is required"
        }), 400

    try:
        score = int(score)
        lines = int(lines)
        level = int(level)
    except (TypeError, ValueError):
        return jsonify({
            "error": "Score, lines and level must be numbers"
        }), 400

    if score < 0:
        return jsonify({
            "error": "Score cannot be negative"
        }), 400

    if lines < 0:
        return jsonify({
            "error": "Lines cannot be negative"
        }), 400

    if level < 1:
        return jsonify({
            "error": "Level must be at least 1"
        }), 400

    player = db.session.execute(
        db.select(Player).where(Player.username == username)
    ).scalar_one_or_none()

    if player is None:
        player = Player(username=username)
        db.session.add(player)
        db.session.flush()

    new_score = Score(
        player_id=player.id,
        score=score,
        lines=lines,
        level=level
    )

    db.session.add(new_score)
    db.session.commit()

    return jsonify({
        "message": "Score submitted successfully",
        "score": {
            "id": new_score.id,
            "username": player.username,
            "score": new_score.score,
            "lines": new_score.lines,
            "level": new_score.level
        }
    }), 201


@app.route("/api/leaderboard", methods=["GET"])
def leaderboard():

    limit = request.args.get("limit", 10, type=int)

    if limit is None or limit < 1:
        limit = 10

    if limit > 100:
        limit = 100

    results = db.session.execute(
        db.select(Score, Player)
        .join(Player, Score.player_id == Player.id)
        .order_by(
            desc(Score.score),
            desc(Score.lines),
            Score.created_at.asc()
        )
        .limit(limit)
    ).all()

    leaderboard_data = []

    for rank, (score_record, player) in enumerate(results, start=1):

        leaderboard_data.append({
            "rank": rank,
            "username": player.username,
            "score": score_record.score,
            "lines": score_record.lines,
            "level": score_record.level,
            "created_at": score_record.created_at.isoformat()
        })

    return jsonify({
        "leaderboard": leaderboard_data
    })


@app.route("/api/players/<username>", methods=["GET"])
def player_stats(username):

    player = db.session.execute(
        db.select(Player).where(Player.username == username)
    ).scalar_one_or_none()

    if player is None:
        return jsonify({
            "error": "Player not found"
        }), 404

    scores = db.session.execute(
        db.select(Score)
        .where(Score.player_id == player.id)
        .order_by(desc(Score.score))
    ).scalars().all()

    total_games = len(scores)

    best_score = max(
        (item.score for item in scores),
        default=0
    )

    best_lines = max(
        (item.lines for item in scores),
        default=0
    )

    return jsonify({
        "username": player.username,
        "statistics": {
            "total_games": total_games,
            "best_score": best_score,
            "best_lines": best_lines
        },
        "scores": [
            {
                "score": item.score,
                "lines": item.lines,
                "level": item.level,
                "created_at": item.created_at.isoformat()
            }
            for item in scores
        ]
    })


@app.errorhandler(404)
def not_found(error):
    return jsonify({
        "error": "Endpoint not found"
    }), 404


@app.errorhandler(500)
def internal_error(error):
    db.session.rollback()

    return jsonify({
        "error": "Internal server error"
    }), 500


with app.app_context():
    db.create_all()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )
