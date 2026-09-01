from flask import Flask, jsonify, request
from sqlalchemy import desc

from config import Config
from models import db, Player, Score


# ============================================================
# FLASK APPLICATION
# ============================================================

app = Flask(__name__)
app.config.from_object(Config)

# Connect SQLAlchemy to Flask
db.init_app(app)


# ============================================================
# HOME
# ============================================================

@app.route("/", methods=["GET"])
def home():
    return jsonify({
        "application": "Cloud-Native Tetris Gaming Platform",
        "status": "running",
        "version": "1.0.0"
    }), 200


# ============================================================
# HEALTH CHECK
# ============================================================

@app.route("/health", methods=["GET"])
def health():

    try:
        # Test database connection
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


# ============================================================
# API STATUS
# ============================================================

@app.route("/api", methods=["GET"])
def api_status():

    return jsonify({
        "application": "Cloud-Native Tetris Gaming Platform",
        "api": "running",
        "endpoints": {
            "health": "/health",
            "submit_score": "POST /api/scores",
            "leaderboard": "GET /api/leaderboard",
            "player_stats": "GET /api/players/<username>"
        }
    }), 200


# ============================================================
# SUBMIT SCORE
# ============================================================

@app.route("/api/scores", methods=["POST"])
def submit_score():

    data = request.get_json(silent=True)

    # Check JSON body
    if not data:

        return jsonify({
            "error": "Request body must contain JSON data"
        }), 400

    # Get values
    username = str(
        data.get("username", "")
    ).strip()

    score = data.get("score")
    lines = data.get("lines", 0)
    level = data.get("level", 1)

    # --------------------------------------------------------
    # Validate username
    # --------------------------------------------------------

    if not username:

        return jsonify({
            "error": "Username is required"
        }), 400

    if len(username) > 50:

        return jsonify({
            "error": "Username must be 50 characters or less"
        }), 400

    # --------------------------------------------------------
    # Validate numbers
    # --------------------------------------------------------

    try:

        score = int(score)
        lines = int(lines)
        level = int(level)

    except (TypeError, ValueError):

        return jsonify({
            "error": "score, lines and level must be numbers"
        }), 400

    # --------------------------------------------------------
    # Validate values
    # --------------------------------------------------------

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

    try:

        # ----------------------------------------------------
        # Find player
        # ----------------------------------------------------

        player = db.session.execute(
            db.select(Player)
            .where(Player.username == username)
        ).scalar_one_or_none()

        # ----------------------------------------------------
        # Create player if not found
        # ----------------------------------------------------

        if player is None:

            player = Player(
                username=username
            )

            db.session.add(player)

            # Get generated player ID
            db.session.flush()

        # ----------------------------------------------------
        # Create score
        # ----------------------------------------------------

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


# ============================================================
# LEADERBOARD
# ============================================================

@app.route("/api/leaderboard", methods=["GET"])
def leaderboard():

    try:

        # ----------------------------------------------------
        # Number of leaderboard entries
        # ----------------------------------------------------

        limit = request.args.get(
            "limit",
            default=10,
            type=int
        )

        # Protect API
        if limit < 1:
            limit = 10

        if limit > 100:
            limit = 100

        # ----------------------------------------------------
        # Get highest scores
        # ----------------------------------------------------

        results = db.session.execute(

            db.select(Score, Player)

            .join(
                Player,
                Score.player_id == Player.id
            )

            .order_by(
                desc(Score.score),
                desc(Score.lines),
                Score.created_at.asc()
            )

            .limit(limit)

        ).all()

        leaderboard_data = []

        # ----------------------------------------------------
        # Build response
        # ----------------------------------------------------

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


# ============================================================
# PLAYER STATISTICS
# ============================================================

@app.route(
    "/api/players/<username>",
    methods=["GET"]
)
def player_stats(username):

    username = username.strip()

    try:

        # ----------------------------------------------------
        # Find player
        # ----------------------------------------------------

        player = db.session.execute(

            db.select(Player)

            .where(
                Player.username == username
            )

        ).scalar_one_or_none()

        if player is None:

            return jsonify({

                "error": "Player not found",

                "username": username

            }), 404

        # ----------------------------------------------------
        # Get player's scores
        # ----------------------------------------------------

        scores = db.session.execute(

            db.select(Score)

            .where(
                Score.player_id == player.id
            )

            .order_by(
                desc(Score.score)
            )

        ).scalars().all()

        # ----------------------------------------------------
        # Calculate statistics
        # ----------------------------------------------------

        total_games = len(scores)

        best_score = max(
            (item.score for item in scores),
            default=0
        )

        best_lines = max(
            (item.lines for item in scores),
            default=0
        )

        best_level = max(
            (item.level for item in scores),
            default=1
        )

        # ----------------------------------------------------
        # Return player information
        # ----------------------------------------------------

        return jsonify({

            "username": player.username,

            "statistics": {

                "total_games": total_games,

                "best_score": best_score,

                "best_lines": best_lines,

                "best_level": best_level
            },

            "scores": [

                {
                    "score": item.score,

                    "lines": item.lines,

                    "level": item.level,

                    "created_at": (
                        item.created_at.isoformat()
                        if item.created_at
                        else None
                    )
                }

                for item in scores
            ]

        }), 200

    except Exception as error:

        return jsonify({

            "error": "Failed to load player statistics",

            "details": str(error)

        }), 500


# ============================================================
# 404 ERROR HANDLER
# ============================================================

@app.errorhandler(404)
def page_not_found(error):

    return jsonify({

        "error": "Endpoint not found",

        "message": "The requested API endpoint does not exist"

    }), 404


# ============================================================
# 405 METHOD NOT ALLOWED
# ============================================================

@app.errorhandler(405)
def method_not_allowed(error):

    return jsonify({

        "error": "Method not allowed"

    }), 405


# ============================================================
# 500 ERROR HANDLER
# ============================================================

@app.errorhandler(500)
def internal_server_error(error):

    db.session.rollback()

    return jsonify({

        "error": "Internal server error"

    }), 500


# ============================================================
# CREATE DATABASE TABLES
# ============================================================

with app.app_context():

    try:

        db.create_all()

        print("Database tables verified successfully.")

    except Exception as error:

        print("Database initialization failed:")
        print(error)


# ============================================================
# START FLASK
# ============================================================

if __name__ == "__main__":

    app.run(
        host="0.0.0.0",
        port=5000,
        debug=True
    )
