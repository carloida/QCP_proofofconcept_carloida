# AI Agent for GST F5 Filing Automation

Human-in-the-loop GST compliance workflow prototype for quarterly Singapore GST F5 filing preparation.

This capstone prototype demonstrates how an AI-assisted compliance operations dashboard can reduce manual GST preparation effort and compliance risk while keeping accountants and managers in control.

Important: this prototype prepares filing-ready outputs for manual submission via IRAS myTax Portal. It does not submit directly to IRAS.

## What The Application Does

- Starts with an empty GST filing workspace.
- Supports transaction ingestion from CSV, Excel, and structured PDF uploads.
- Keeps database and accounting API connector surfaces empty until real integrations are configured.
- Separates transaction data sources from supporting evidence uploads.
- Standardizes transactions into a canonical GST schema.
- Uses real AI only for two controlled assistance points when configured: ingestion data quality review and GST treatment classification.
- Keeps evidence matching, reconciliation, GST F5 computation, workflow orchestration, audit, and export as deterministic controls or placeholders.
- Detects reconciliation and anomaly issues such as missing export evidence, missing tax invoices, duplicate invoices, FX gaps, and high-severity blockers.
- Routes low-confidence or risky classifications to human accountant review.
- Supports human review, override reason capture, and anomaly resolution statuses.
- Computes GST F5 Box 1 to Box 8 with traceable formulas and transaction counts.
- Requires manager or final approval before the workflow is approved for manual submission.
- Maintains an audit trail for AI, system, accountant, and manager actions.
- Generates export-ready filing pack materials for manual submission preparation.

## Starting State

The application opens with no filing period, no transactions, no anomalies, and no GST F5 values. Create a reporting period and upload your own transaction CSV, Excel file, or structured PDF to begin.

## Dummy Upload Files

Use these clean files to try the workflow end to end:

```text
test_files/qcp_clean_gst_transactions.xlsx
test_files/qcp_clean_gst_transactions.pdf
```

Both files contain six Q1 2026 GST transactions designed to pass classification, reconciliation, approval, and export without manual cleanup. The PDF is a structured transaction export with pipe-delimited rows so the prototype can parse it reliably.

## Tech Stack

Frontend:

- React
- TypeScript
- Vite
- Tailwind CSS

Backend:

- FastAPI
- SQLite
- Pandas
- Pydantic
- OpenAI Python SDK for the two optional AI-assisted agents

## Project Structure

```text
backend/
  main.py
  database.py
  models.py
  schemas.py
  requirements.txt
  services/

frontend/
  index.html
  package.json
  src/
    App.tsx
    api.ts
    workflow.ts
    styles.css
    components/
```

## Run Locally

### Frontend

```bash
cd frontend
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:5173
```

### Backend

```bash
cd backend
python -m venv .venv
.venv\Scripts\activate
pip install -r requirements.txt
uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

Backend health check:

```text
http://127.0.0.1:8000/health
```

## Optional AI API Setup

The app runs without an API key. If no key is configured, the two AI-assisted agents use deterministic fallback logic and the UI shows fallback mode.

For local AI testing:

1. Copy `backend/.env.example` to `backend/.env`.
2. Add your backend-only API key:

```text
OPENAI_API_KEY=your_api_key_here
OPENAI_MODEL=gpt-4.1-mini
AI_ENABLED=true
```

Optional cost estimate settings:

```text
OPENAI_INPUT_COST_PER_1M_TOKENS_USD=
OPENAI_OUTPUT_COST_PER_1M_TOKENS_USD=
USD_TO_SGD_RATE=
```

Never commit a real API key. The frontend never receives or stores the key.

AI status endpoint:

```text
GET http://127.0.0.1:8000/ai/status
```

Period AI usage endpoint:

```text
GET http://127.0.0.1:8000/api/filing-periods/{period_id}/ai-usage
```

AI-assisted agent endpoints:

```text
POST http://127.0.0.1:8000/api/filing-periods/{period_id}/ai/ingestion-quality-review
POST http://127.0.0.1:8000/api/filing-periods/{period_id}/ai/classify-gst-treatment
```

Suggested test flow:

1. Start backend and frontend.
2. Create a reporting quarter.
3. Upload `test_files/qcp_clean_gst_transactions.xlsx` or `test_files/qcp_clean_gst_transactions.pdf`.
4. Open the AI Agent Runtime card in the Compliance Panel.
5. Run Ingestion & Data Quality review.
6. Run AI GST classification.
7. Review token usage, fallback status, audit events, and any human review queue items.

## Agent Architecture

Real AI enabled:

- Ingestion & Data Quality Agent
- GST Treatment Classification Agent

Deterministic controls or placeholders:

- Evidence Matching Agent
- Reconciliation & Anomaly Detection Agent
- GST F5 Computation Agent
- Compliance Workflow Orchestrator Agent
- Audit Trail & Explainability Module
- Filing Pack / Export Module

This is intentional. The architecture is a controlled hybrid finance compliance workflow: AI assists where interpretation and classification add value, while deterministic rules and human approval protect compliance control.

## Compliance Positioning

The product should be presented as AI-assisted GST F5 preparation, not autonomous tax filing.

The application intentionally reinforces:

- AI recommends; humans review and approve.
- Human accountants can override AI recommendations.
- Manager final approval is required.
- Filing outputs are prepared for manual submission via IRAS myTax Portal.
- This prototype does not submit directly to IRAS.

