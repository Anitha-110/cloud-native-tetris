from datetime import datetime

from flask_sqlalchemy import SQLAlchemy

db = SQLAlchemy()


class Player(db.Model):
    __tablename__ = "players"

    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(100), unique=True, nullable=False)

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )

    scores = db.relationship(
        "Score",
        backref="player",
        lazy=True,
        cascade="all, delete-orphan"
    )


class Score(db.Model):
    __tablename__ = "scores"

    id = db.Column(db.Integer, primary_key=True)

    player_id = db.Column(
        db.Integer,
        db.ForeignKey("players.id"),
        nullable=False
    )

    score = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    lines = db.Column(
        db.Integer,
        nullable=False,
        default=0
    )

    level = db.Column(
        db.Integer,
        nullable=False,
        default=1
    )

    created_at = db.Column(
        db.DateTime,
        default=datetime.utcnow,
        nullable=False
    )
