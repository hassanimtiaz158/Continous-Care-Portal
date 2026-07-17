# Cardiology Module — Integration Guide

## 1. Copy files
Copy every file in this bundle into your repo at the matching path
(backend/app/..., frontend/src/..., specs/...).

## 2. Wire the router into main.py (2 lines — see main_py_integration.patch)

Add near the other app.* imports:
    from app.cardio_routes import cardio_router

Add right after `app = FastAPI(...)`:
    app.include_router(cardio_router)

## 3. Run tests
    cd backend && python -m pytest app/test_cardio_pathway.py app/test_cardio_orders.py \
        app/test_cardio_coordination.py app/test_cardio_routes.py -q
    # then the full suite to confirm zero regressions:
    python -m pytest app/ -q

## 4. Frontend
    cd frontend && npx tsc --noEmit    # confirms CardiologyBoard.tsx + cardioApi.ts typecheck

Mount <CardiologyBoard intake={classification} /> wherever a case detail view
lives, passing it the IntakeClassification returned from
POST /api/cardiology/intake.

## 5. Try the 6 reference cases against the real backend
POST /api/cardiology/intake with, e.g.:
{
  "case_id": "C-DISSECT-1",
  "diagnosis_id": "AORTIC_DISSECTION",
  "source": "emergency",
  "is_concurrent_with": ["cardiothoracic_surgery"]
}
Valid diagnosis_id values: AORTIC_DISSECTION, HOCM_SUSPECTED, ACUTE_MI,
KAWASAKI_DISEASE, ACUTE_STROKE_HTN_DM, SLE_PERICARDITIS
