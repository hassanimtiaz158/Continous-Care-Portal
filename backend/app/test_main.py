from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health():
    r = client.get("/api/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] == "ok"
    assert isinstance(data["anthropic_key_set"], bool)


def test_board_run():
    r = client.post("/api/board/run", params={"patient_id": "CCP-014"})
    assert r.status_code == 200
    assert "patient_id" in r.json()
