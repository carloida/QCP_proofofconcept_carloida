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
- Uses AI-style classification outputs to recommend GST treatment, confidence, evidence status, and review priority.
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

## Compliance Positioning

The product should be presented as AI-assisted GST F5 preparation, not autonomous tax filing.

The application intentionally reinforces:

- AI recommends; humans review and approve.
- Human accountants can override AI recommendations.
- Manager final approval is required.
- Filing outputs are prepared for manual submission via IRAS myTax Portal.
- This prototype does not submit directly to IRAS.

