from datetime import datetime, timezone

from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import Integer, String, DateTime


db = SQLAlchemy()


class Player(db.Model):
    __tablename__ = "players"

    id = db.Column(Integer, primary_key=True)
    username = db.Column(String(50), unique=True, nullable=False, index=True)
    created_at = db.Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
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

    id = db.Column(Integer, primary_key=True)

    player_id = db.Column(
        Integer,
        db.ForeignKey("players.id"),
        nullable=False,
        index=True
    )

    score = db.Column(Integer, nullable=False)
    lines = db.Column(Integer, nullable=False, default=0)
    level = db.Column(Integer, nullable=False, default=1)

    created_at = db.Column(
        DateTime,
        default=lambda: datetime.now(timezone.utc),
        nullable=False,
        index=True
    )
