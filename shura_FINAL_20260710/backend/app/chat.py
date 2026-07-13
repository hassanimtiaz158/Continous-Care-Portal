"""Doctor-to-Doctor Chat — TDD §3.3 / PRD FR-11, FR-12.

One thread per patient case, visible to Family Medicine and the relevant
Specialist(s). Reuses the same SQLite connection as the audit trail
(audit.db) so chat history persists across restarts alongside board
sessions, rather than living in a separate in-memory dict that would be
lost on every server reload.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone
from typing import Any

from app.audit import _get_conn

_CHAT_SCHEMA_READY = False


def _ensure_chat_schema() -> None:
    """Create the chat_messages table if it doesn't exist yet.

    Called lazily (not at import time) so it always runs against
    whichever connection audit._get_conn() currently holds — important
    for tests, which repoint the DB to ":memory:" per test run.
    """
    conn = _get_conn()
    conn.executescript(
        """
        CREATE TABLE IF NOT EXISTS chat_messages (
            id            TEXT PRIMARY KEY,
            patient_id    TEXT NOT NULL,
            sender_name   TEXT NOT NULL,
            sender_role   TEXT NOT NULL,
            text          TEXT NOT NULL,
            created_at    TEXT NOT NULL
        );
        """
    )
    conn.commit()


def send_message(
    patient_id: str,
    sender_name: str,
    sender_role: str,
    text: str,
) -> dict[str, Any]:
    """Post a message to a patient's chat thread and return the stored record."""
    _ensure_chat_schema()
    conn = _get_conn()
    msg_id = f"MSG-{uuid.uuid4().hex[:12]}"
    now = datetime.now(timezone.utc).isoformat()

    conn.execute(
        """
        INSERT INTO chat_messages (id, patient_id, sender_name, sender_role, text, created_at)
        VALUES (?, ?, ?, ?, ?, ?)
        """,
        (msg_id, patient_id, sender_name, sender_role, text, now),
    )
    conn.commit()

    return {
        "id": msg_id,
        "patient_id": patient_id,
        "sender_name": sender_name,
        "sender_role": sender_role,
        "text": text,
        "created_at": now,
    }


def get_messages(patient_id: str) -> list[dict[str, Any]]:
    """Return all messages for a patient's chat thread, oldest first."""
    _ensure_chat_schema()
    conn = _get_conn()
    rows = conn.execute(
        """
        SELECT id, patient_id, sender_name, sender_role, text, created_at
        FROM chat_messages
        WHERE patient_id = ?
        ORDER BY created_at ASC
        """,
        (patient_id,),
    ).fetchall()
    return [dict(row) for row in rows]
