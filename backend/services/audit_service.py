from __future__ import annotations

import sqlite3

from models import Actor


def write_audit(
    conn: sqlite3.Connection,
    filing_period_id: int,
    actor: Actor,
    action: str,
    details: str,
    transaction_id: int | None = None,
    affected_item: str | None = None,
    old_value: str | None = None,
    new_value: str | None = None,
    reason: str | None = None,
    step: str | None = None,
) -> None:
    conn.execute(
        """
        INSERT INTO audit_log (
            filing_period_id, transaction_id, actor, actor_type, action, details,
            affected_item, old_value, new_value, reason, step
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            filing_period_id,
            transaction_id,
            actor.value,
            "Human" if actor.value == "USER" else actor.value.title(),
            action,
            details,
            affected_item,
            old_value,
            new_value,
            reason,
            step,
        ),
    )
