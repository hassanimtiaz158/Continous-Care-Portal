# Continuous Care Portal (CCP)

Multi-agent clinical assistant for chronic-disease care. Produces transparent, evidence-linked, physician-reviewed care recommendations — **not a diagnosis, not an order.**

## Project Structure

```
├── backend/     FastAPI (Python 3.11+)
├── frontend/    Vite + React (existing ClinicalBoard.jsx)
├── specs/       PRD, TDD, and prototype source
```

## Prerequisites

- Python 3.11+
- Node.js 18+
- [uv](https://docs.astral.sh/uv/) (or pip/poetry)

## Backend

```bash
cd backend

# Create venv and install deps (uv)
uv venv
uv pip install -e ".[dev]"

# Or with pip
python -m venv .venv
.venv\Scripts\activate   # Windows
pip install -e ".[dev]"

# Copy env file and add your key
copy ..\.env.example .env
# Edit .env → set ANTHROPIC_API_KEY

# Run server
uvicorn app.main:app --reload --port 8000

# Run tests
pytest
```

## Frontend

```bash
cd frontend
npm install
npm run dev
```

Vite proxies `/api/*` requests to `http://localhost:8000`, so the frontend can call backend endpoints without CORS issues during development.

## Environment Variables

See `.env.example` at the repo root:

| Variable | Required | Purpose |
|---|---|---|
| `ANTHROPIC_API_KEY` | Yes | Anthropic API key for Claude |
| `KIMI_API_KEY` | No | Fallback LLM provider |

## Architecture

```
React Frontend → FastAPI Backend → Agent Orchestrator → Anthropic / Kimi
                                                       ↓
                              Archivist (deterministic) → Specialist Agents → Double Grounding → Board Chair
                                                       ↓
                              Human Review Workspace (Physician: Approve / Edit / Reject)
```

## Key Principles

- **No AI autonomy.** All recommendations require physician review before action.
- **Full provenance.** Every finding links back to source data and calculation method.
- **No secrets in frontend.** All LLM calls go through the backend.

## License

USAII Global AI Hackathon 2026
