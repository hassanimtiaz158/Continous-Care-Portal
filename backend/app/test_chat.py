"""Tests for the Doctor-to-Doctor chat feature (PRD FR-11/FR-12)."""

from __future__ import annotations

from fastapi.testclient import TestClient

from app.audit import init_audit_db
from app.chat import get_messages, send_message
from app.main import app

client = TestClient(app)


class TestChatModule:
    def setup_method(self):
        init_audit_db(":memory:")

    def test_send_and_get_message(self):
        msg = send_message("EG-TEST", "Dr. A", "family", "Referring case.")
        assert msg["patient_id"] == "EG-TEST"
        assert msg["text"] == "Referring case."
        assert msg["id"].startswith("MSG-")

        history = get_messages("EG-TEST")
        assert len(history) == 1
        assert history[0]["text"] == "Referring case."

    def test_messages_are_ordered_oldest_first(self):
        send_message("EG-ORDER", "Dr. A", "family", "first")
        send_message("EG-ORDER", "Dr. B", "specialist", "second")
        history = get_messages("EG-ORDER")
        assert [m["text"] for m in history] == ["first", "second"]

    def test_threads_are_scoped_per_patient(self):
        send_message("EG-P1", "Dr. A", "family", "for patient 1")
        send_message("EG-P2", "Dr. B", "family", "for patient 2")
        assert len(get_messages("EG-P1")) == 1
        assert len(get_messages("EG-P2")) == 1
        assert get_messages("EG-P1")[0]["text"] == "for patient 1"


class TestChatEndpoints:
    def test_post_and_get_via_api(self):
        r1 = client.post(
            "/api/patients/EG-4471/chat",
            json={"sender_name": "Dr. Amina (FM)", "sender_role": "family", "text": "Referring for renal review."},
        )
        assert r1.status_code == 200
        assert r1.json()["text"] == "Referring for renal review."

        r2 = client.get("/api/patients/EG-4471/chat")
        assert r2.status_code == 200
        assert any(m["text"] == "Referring for renal review." for m in r2.json())

    def test_post_to_unknown_patient_404(self):
        r = client.post(
            "/api/patients/EG-DOES-NOT-EXIST/chat",
            json={"sender_name": "X", "sender_role": "family", "text": "hi"},
        )
        assert r.status_code == 404

    def test_get_unknown_patient_404(self):
        r = client.get("/api/patients/EG-DOES-NOT-EXIST/chat")
        assert r.status_code == 404

    def test_empty_message_rejected(self):
        r = client.post(
            "/api/patients/EG-4471/chat",
            json={"sender_name": "X", "sender_role": "family", "text": "   "},
        )
        assert r.status_code == 400
