"""Structured Audit Trail — TDD §2.10.

SQLite-backed log recording every board session:
- Timestamp
- Which agents responded/failed
- Generated recommendations
- Physician decision
- Physician edits
- Reviewing physician identifier
"""

from __future__ import annotations

import json
import sqlite3
import uuid
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

_DB_PATH: Path | None = None
_conn: sqlite3.Connection | None = None


def _get_conn(db_path: Path | str | None = None) -> sqlite3.Connection:
    """Return (and lazily create) a module-level SQLite connection."""
    global _conn, _DB_PATH
    if db_path is not None:
        _DB_PATH = Path(db_path) if db_path != ":memory:" else None
        # If changing DB, close old connection
        if _conn is not None:
            _conn.close()
            _conn = None
    if _conn is None:
        if _DB_PATH is None and db_path == ":memory:":
            _conn = sqlite3.connect(":memory:", check_same_thread=False)
        else:
            path = _DB_PATH or Path(__file__).resolve().parent.parent / "audit.db"
            _conn = sqlite3.connect(str(path), check_same_thread=False)
        _conn.row_factory = sqlite3.Row
        _init_schema(_conn)
    return _conn


def _init_schema(conn: sqlite3.Connection) -> None:
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS board_sessions (
            session_id    TEXT PRIMARY KEY,
            patient_id    TEXT NOT NULL,
            created_at    TEXT NOT NULL,
            agent_status  TEXT NOT NULL,
            recommendations TEXT NOT NULL,
            data_completeness INTEGER,
            confidence_scores TEXT,
            -- physician decision fields (initially NULL)
            decision      TEXT,
            edited_text   TEXT,
            physician_note TEXT,
            physician_name TEXT,
            decided_at    TEXT
        );
        """
    )
    conn.commit()


def init_audit_db(db_path: Path | str | None = None) -> None:
    """Explicitly initialise the audit database (for tests / startup).

    Pass ``":memory:"`` for an in-memory database (tests).
    """
    _get_conn(db_path)


def close_audit_db() -> None:
    """Close the database connection."""
    global _conn
    if _conn is not None:
        _conn.close()
        _conn = None


def create_session(
    patient_id: str,
    specialist_results: dict[str, dict[str, Any]],
    consensus: dict[str, Any],
    data_completeness: int,
    confidence_scores: dict[str, int],
) -> str:
    """Record a new board session and return the session_id.

    Called at the end of run_board() so the frontend receives a
    session_id it can later reference for the decision endpoint.
    """
    session_id = f"CCP-SESSION-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    # Summarise which agents responded vs failed
    agent_status: dict[str, str] = {}
    for key, result in specialist_results.items():
        if result.get("failed") or result.get("risk_level") == "watch" and any(
            "unavailable" in (f.get("text") or "") for f in result.get("findings", [])
        ):
            agent_status[key] = "failed"
        else:
            agent_status[key] = "responded"

    recommendations: dict[str, str] = {}
    for key, result in specialist_results.items():
        recommendations[key] = result.get("recommendation", "")

    conn = _get_conn()
    conn.execute(
        """
        INSERT INTO board_sessions
            (session_id, patient_id, created_at, agent_status,
             recommendations, data_completeness, confidence_scores)
        VALUES (?, ?, ?, ?, ?, ?, ?)
        """,
        (
            session_id,
            patient_id,
            now,
            json.dumps(agent_status),
            json.dumps(recommendations),
            data_completeness,
            json.dumps(confidence_scores),
        ),
    )
    conn.commit()
    return session_id


def record_decision(
    session_id: str,
    decision: str,
    edited_text: str | None = None,
    physician_note: str | None = None,
    physician_name: str | None = None,
) -> str:
    """Record the physician's decision and return the audit_entry_id.

    *decision* must be one of: "approved", "edited", "rejected".
    """
    conn = _get_conn()
    now = datetime.now(timezone.utc).isoformat()

    row = conn.execute(
        "SELECT session_id FROM board_sessions WHERE session_id = ?",
        (session_id,),
    ).fetchone()
    if row is None:
        raise ValueError(f"Session {session_id} not found")

    conn.execute(
        """
        UPDATE board_sessions
        SET decision = ?, edited_text = ?, physician_note = ?,
            physician_name = ?, decided_at = ?
        WHERE session_id = ?
        """,
        (decision, edited_text, physician_note, physician_name, now, session_id),
    )
    conn.commit()
    return session_id


def get_audit_trail(session_id: str) -> dict[str, Any] | None:
    """Retrieve the full audit trail for a board session.

    Returns None if the session does not exist.
    """
    conn = _get_conn()
    row = conn.execute(
        "SELECT * FROM board_sessions WHERE session_id = ?",
        (session_id,),
    ).fetchone()
    if row is None:
        return None

    return {
        "session_id": row["session_id"],
        "patient_id": row["patient_id"],
        "created_at": row["created_at"],
        "agent_status": json.loads(row["agent_status"]),
        "recommendations": json.loads(row["recommendations"]),
        "data_completeness": row["data_completeness"],
        "confidence_scores": json.loads(row["confidence_scores"]) if row["confidence_scores"] else {},
        "decision": row["decision"],
        "edited_text": row["edited_text"],
        "physician_note": row["physician_note"],
        "physician_name": row["physician_name"],
        "decided_at": row["decided_at"],
    }
