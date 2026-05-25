# AI Agent for GST F5 Filing Automation

Human-in-the-loop GST compliance workflow prototype for quarterly Singapore GST F5 filing preparation.

This capstone prototype demonstrates how an AI-assisted compliance operations dashboard can reduce manual GST preparation effort and compliance risk while keeping accountants and managers in control.

Important: this prototype prepares filing-ready outputs for manual submission via IRAS myTax Portal. It does not submit directly to IRAS.

## What The Application Does

- Loads quarterly GST filing data for Q2 2026 demo review.
- Supports transaction ingestion from CSV / Excel, sample data, simulated database connectors, and simulated accounting API connectors.
- Separates transaction data sources from supporting evidence uploads.
- Standardizes transactions into a canonical GST schema.
- Uses AI-style classification outputs to recommend GST treatment, confidence, evidence status, and review priority.
- Detects reconciliation and anomaly issues such as missing export evidence, missing tax invoices, duplicate invoices, FX gaps, and high-severity blockers.
- Routes low-confidence or risky classifications to human accountant review.
- Supports human review, override reason capture, and anomaly resolution statuses.
- Computes GST F5 Box 1 to Box 8 with traceable formulas and transaction counts.
- Requires manager or final approval before the workflow is approved for manual submission.
- Maintains an audit trail for AI, system, accountant, and manager actions.
- Generates export-ready filing pack materials for manual submission preparation.

## Demo State

The frontend includes a polished fallback demo state so the dashboard remains useful even when the backend API is not running.

- Reporting quarter: Q2 2026
- GST registration: Confirmed
- Filing readiness: Review Required
- Current owner: Human Accountant
- Transactions ingested: 128
- Human reviews required: 6
- Blocking issues: 2
- High-severity anomalies: 2

Mock GST F5 values:

- Box 1: SGD 850,000
- Box 2: SGD 120,000
- Box 3: SGD 30,000
- Box 4: SGD 1,000,000
- Box 5: SGD 420,000
- Box 6: SGD 76,500
- Box 7: SGD 31,500
- Box 8: SGD 45,000

Box 4 equals Box 1 + Box 2 + Box 3. Box 8 equals Box 6 - Box 7.

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

## Project Structure

```text
backend/
  main.py
  database.py
  models.py
  schemas.py
  requirements.txt
  sample_data/
  services/

frontend/
  index.html
  package.json
  src/
    App.tsx
    api.ts
    mockData.ts
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

## Compliance Positioning

The product should be presented as AI-assisted GST F5 preparation, not autonomous tax filing.

The application intentionally reinforces:

- AI recommends; humans review and approve.
- Human accountants can override AI recommendations.
- Manager final approval is required.
- Filing outputs are prepared for manual submission via IRAS myTax Portal.
- This prototype does not submit directly to IRAS.

