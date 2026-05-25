from __future__ import annotations

import sqlite3
from pathlib import Path

DB_PATH = Path(__file__).resolve().parent / "gst_f5_compliance.db"


def get_connection() -> sqlite3.Connection:
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA foreign_keys = ON")
    return conn


def init_db() -> None:
    with get_connection() as conn:
        conn.executescript(
            """
            CREATE TABLE IF NOT EXISTS filing_periods (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                start_date TEXT NOT NULL,
                end_date TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'DRAFT',
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                approved_at TEXT
            );

            CREATE TABLE IF NOT EXISTS transactions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filing_period_id INTEGER NOT NULL,
                transaction_date TEXT NOT NULL,
                invoice_no TEXT,
                source_system TEXT,
                transaction_type TEXT NOT NULL,
                counterparty_name TEXT,
                counterparty_country TEXT,
                gl_account TEXT,
                description TEXT,
                currency TEXT NOT NULL DEFAULT 'SGD',
                net_amount REAL NOT NULL,
                gst_amount REAL NOT NULL,
                gross_amount REAL NOT NULL,
                original_tax_code TEXT,
                gst_treatment TEXT NOT NULL,
                classification_confidence REAL NOT NULL,
                classification_reason TEXT NOT NULL,
                review_status TEXT NOT NULL,
                anomaly_score REAL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (filing_period_id) REFERENCES filing_periods(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS reconciliation_exceptions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER NOT NULL,
                severity TEXT NOT NULL,
                exception_type TEXT NOT NULL,
                message TEXT NOT NULL,
                resolved INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS overrides (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                transaction_id INTEGER NOT NULL,
                old_treatment TEXT NOT NULL,
                new_treatment TEXT NOT NULL,
                reason TEXT NOT NULL,
                user_name TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE CASCADE
            );

            CREATE TABLE IF NOT EXISTS audit_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                filing_period_id INTEGER NOT NULL,
                transaction_id INTEGER,
                actor TEXT NOT NULL,
                action TEXT NOT NULL,
                details TEXT NOT NULL,
                created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (filing_period_id) REFERENCES filing_periods(id) ON DELETE CASCADE,
                FOREIGN KEY (transaction_id) REFERENCES transactions(id) ON DELETE SET NULL
            );
            """
        )
        _ensure_column(conn, "reconciliation_exceptions", "status", "TEXT NOT NULL DEFAULT 'Open'")
        _ensure_column(conn, "reconciliation_exceptions", "resolution_comment", "TEXT")
        _ensure_column(conn, "audit_log", "actor_type", "TEXT")
        _ensure_column(conn, "audit_log", "affected_item", "TEXT")
        _ensure_column(conn, "audit_log", "old_value", "TEXT")
        _ensure_column(conn, "audit_log", "new_value", "TEXT")
        _ensure_column(conn, "audit_log", "reason", "TEXT")
        _ensure_column(conn, "audit_log", "step", "TEXT")
        conn.execute("UPDATE audit_log SET actor_type = actor WHERE actor_type IS NULL")


def row_to_dict(row: sqlite3.Row | None) -> dict | None:
    return dict(row) if row else None


def _ensure_column(conn: sqlite3.Connection, table: str, column: str, definition: str) -> None:
    columns = [row["name"] for row in conn.execute(f"PRAGMA table_info({table})").fetchall()]
    if column not in columns:
        conn.execute(f"ALTER TABLE {table} ADD COLUMN {column} {definition}")
