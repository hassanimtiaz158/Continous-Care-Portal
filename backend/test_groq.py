import asyncio, os, json
from dotenv import load_dotenv
from pathlib import Path
load_dotenv(Path(__file__).resolve().parent / ".env")
from openai import AsyncOpenAI
from app.agents import AGENTS, CHAIR_SYSTEM
from app.archivist import compute_archivist_summary
from app.deidentify import deidentify
from app.main import CCP014

async def test():
    key = os.getenv("GROQ_API_KEY")
    client = AsyncOpenAI(api_key=key, base_url="https://api.groq.com/openai/v1")
    archivist = compute_archivist_summary(CCP014)
    clinical = deidentify(CCP014)

    patient_summary = json.dumps(clinical.model_dump(mode="json"), indent=2)
    archivist_brief = json.dumps({k: v.model_dump(mode="json") for k, v in archivist.metrics.items()}, indent=2)
    user_content = f"De-identified clinical record:\n{patient_summary}\n\nArchivist's computed trends:\n{archivist_brief}\n\nGive your specialist opinion."

    for agent in AGENTS:
        r = await client.chat.completions.create(
            model="llama-3.3-70b-versatile",
            max_tokens=500,
            messages=[
                {"role": "system", "content": agent.system},
                {"role": "user", "content": user_content},
            ],
        )
        raw = r.choices[0].message.content or ""
        print(f"\n=== {agent.key} ===")
        print(f"Raw (first 300): {raw[:300]}")

    await client.close()

asyncio.run(test())
