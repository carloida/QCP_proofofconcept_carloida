from __future__ import annotations

import os
import sqlite3
from datetime import datetime, timezone
from uuid import uuid4


def _float_env(name: str) -> float | None:
    value = os.getenv(name)
    if value is None or not value.strip():
        return None
    try:
        return float(value)
    except ValueError:
        return None


def estimate_cost(prompt_tokens: int, completion_tokens: int) -> tuple[float | None, float | None]:
    input_cost = _float_env("OPENAI_INPUT_COST_PER_1M_TOKENS_USD")
    output_cost = _float_env("OPENAI_OUTPUT_COST_PER_1M_TOKENS_USD")
    usd_to_sgd = _float_env("USD_TO_SGD_RATE")
    if input_cost is None or output_cost is None:
        return None, None

    usd = (prompt_tokens / 1_000_000 * input_cost) + (completion_tokens / 1_000_000 * output_cost)
    sgd = usd * usd_to_sgd if usd_to_sgd is not None else None
    return round(usd, 6), round(sgd, 6) if sgd is not None else None


def record_ai_usage(
    conn: sqlite3.Connection,
    *,
    period_id: int,
    agent_name: str,
    model: str,
    prompt_tokens: int,
    completion_tokens: int,
    total_tokens: int,
    latency_ms: int,
    status: str,
    fallback_used: bool,
    source_file_id: str | None = None,
) -> dict:
    event_id = str(uuid4())
    estimated_usd, estimated_sgd = estimate_cost(prompt_tokens, completion_tokens)
    created_at = datetime.now(timezone.utc).isoformat()
    conn.execute(
        """
        INSERT INTO ai_usage_events (
            id, period_id, source_file_id, agent_name, model, prompt_tokens,
            completion_tokens, total_tokens, estimated_cost_usd, estimated_cost_sgd,
            latency_ms, status, fallback_used, created_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        """,
        (
            event_id,
            period_id,
            source_file_id,
            agent_name,
            model,
            prompt_tokens,
            completion_tokens,
            total_tokens,
            estimated_usd,
            estimated_sgd,
            latency_ms,
            status,
            1 if fallback_used else 0,
            created_at,
        ),
    )
    return {
        "id": event_id,
        "period_id": period_id,
        "source_file_id": source_file_id,
        "agent_name": agent_name,
        "model": model,
        "prompt_tokens": prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
        "estimated_cost_usd": estimated_usd,
        "estimated_cost_sgd": estimated_sgd,
        "latency_ms": latency_ms,
        "status": status,
        "fallback_used": fallback_used,
        "created_at": created_at,
    }


def get_period_ai_usage(conn: sqlite3.Connection, period_id: int) -> dict:
    rows = conn.execute(
        """
        SELECT * FROM ai_usage_events
        WHERE period_id = ?
        ORDER BY created_at DESC
        """,
        (period_id,),
    ).fetchall()
    events = [
        {
            **dict(row),
            "fallback_used": bool(row["fallback_used"]),
        }
        for row in rows
    ]
    prompt_tokens = sum(int(event["prompt_tokens"]) for event in events)
    completion_tokens = sum(int(event["completion_tokens"]) for event in events)
    total_tokens = sum(int(event["total_tokens"]) for event in events)
    cost_usd_values = [event["estimated_cost_usd"] for event in events if event["estimated_cost_usd"] is not None]
    cost_sgd_values = [event["estimated_cost_sgd"] for event in events if event["estimated_cost_sgd"] is not None]
    return {
        "period_id": period_id,
        "summary": {
            "prompt_tokens": prompt_tokens,
            "completion_tokens": completion_tokens,
            "total_tokens": total_tokens,
            "estimated_cost_usd": round(sum(cost_usd_values), 6) if cost_usd_values else None,
            "estimated_cost_sgd": round(sum(cost_sgd_values), 6) if cost_sgd_values else None,
            "fallback_count": sum(1 for event in events if event["fallback_used"]),
            "request_count": len(events),
            "last_run": events[0] if events else None,
        },
        "events": events,
    }
