import os

from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert isinstance(data["anthropic_key_set"], bool)


def test_board_run_without_key_returns_503():
    """Without ANTHROPIC_API_KEY the endpoint refuses to proceed."""
    key = os.environ.pop("ANTHROPIC_API_KEY", None)
    try:
        r = client.post("/api/board/run", json={"patient_id": "CCP-014"})
        assert r.status_code == 503
    finally:
        if key is not None:
            os.environ["ANTHROPIC_API_KEY"] = key


def test_board_run_unknown_patient_returns_404():
    r = client.post("/api/board/run", json={"patient_id": "NONEXISTENT"})
    assert r.status_code in (404, 503)  # 503 if no key set
