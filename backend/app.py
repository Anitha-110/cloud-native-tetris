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
        "application": "Cloud-Native Tetris",
        "status": "running"
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
        db.session.rollback()

        return jsonify({
            "status": "unhealthy",
            "database": "disconnected",
            "error": str(error)
        }), 503


@app.route("/api")
def api_status():
    return jsonify({
        "message": "Tetris API is running",
        "endpoints": {
            "health": "/health",
            "leaderboard": "/api/leaderboard",
            "scores": "/api/scores"
        }
    })


@app.route("/api/scores", methods=["POST"])
def submit_score():

    data = request.get_json(silent=True)

    if not data:
        return jsonify({
            "error": "JSON body is required"
        }), 400

    username = str(data.get("username", "")).strip()

    if not username:
        return jsonify({
            "error": "Username is required"
        }), 400

    try:
        score = int(data.get("score", 0))
        lines = int(data.get("lines", 0))
        level = int(data.get("level", 1))
    except (TypeError, ValueError):
        return jsonify({
            "error": "score, lines and level must be numbers"
        }), 400

    if score < 0 or lines < 0 or level < 1:
        return jsonify({
            "error": "Invalid score, lines or level"
        }), 400

    try:

        player = db.session.execute(
            db.select(Player)
            .where(Player.username == username)
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

    except Exception as error:

        db.session.rollback()

        return jsonify({
            "error": "Failed to save score",
            "details": str(error)
        }), 500


@app.route("/api/leaderboard", methods=["GET"])
def leaderboard():

    try:

        limit = request.args.get(
            "limit",
            default=10,
            type=int
        )

        limit = max(1, min(limit, 100))

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

        for rank, (score_record, player) in enumerate(
            results,
            start=1
        ):
            leaderboard_data.append({
                "rank": rank,
                "username": player.username,
                "score": score_record.score,
                "lines": score_record.lines,
                "level": score_record.level,
                "created_at": (
                    score_record.created_at.isoformat()
                    if score_record.created_at
                    else None
                )
            })

        return jsonify({
            "leaderboard": leaderboard_data
        }), 200

    except Exception as error:

        return jsonify({
            "error": "Failed to load leaderboard",
            "details": str(error)
        }), 500


with app.app_context():
    db.create_all()


if __name__ == "__main__":
    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )
