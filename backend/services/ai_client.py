from __future__ import annotations

import json
import os
import time
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from dotenv import load_dotenv

load_dotenv(Path(__file__).resolve().parents[1] / ".env", override=True)


REAL_AI_AGENTS = ["ingestion_data_quality", "gst_treatment_classification"]
DETERMINISTIC_MODULES = [
    "evidence_matching",
    "reconciliation_anomaly_detection",
    "gst_f5_computation",
    "workflow_orchestrator",
    "audit_trail",
    "filing_pack_export",
]


@dataclass(frozen=True)
class AiSettings:
    ai_enabled: bool
    api_key_configured: bool
    model: str

    @property
    def ready(self) -> bool:
        return self.ai_enabled and self.api_key_configured


@dataclass(frozen=True)
class AiCallResult:
    data: dict[str, Any]
    prompt_tokens: int
    completion_tokens: int
    total_tokens: int
    latency_ms: int
    model: str


def get_ai_settings() -> AiSettings:
    enabled = os.getenv("AI_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}
    api_key = os.getenv("OPENAI_API_KEY", "").strip()
    model = os.getenv("OPENAI_MODEL", "gpt-4.1-mini").strip() or "gpt-4.1-mini"
    return AiSettings(ai_enabled=enabled, api_key_configured=bool(api_key), model=model)


def ai_status() -> dict:
    settings = get_ai_settings()
    return {
        "ai_enabled": settings.ai_enabled,
        "api_key_configured": settings.api_key_configured,
        "model": settings.model,
        "status": "enabled" if settings.ready else "not_configured" if settings.ai_enabled else "disabled",
        "enabled_agents": REAL_AI_AGENTS if settings.ready else [],
        "ai_capable_agents": REAL_AI_AGENTS,
        "deterministic_modules": DETERMINISTIC_MODULES,
    }


def run_structured_json(
    *,
    system_prompt: str,
    user_payload: dict[str, Any],
    schema_name: str,
    schema: dict[str, Any],
) -> AiCallResult:
    settings = get_ai_settings()
    if not settings.ready:
        raise RuntimeError("AI is not configured")

    from openai import OpenAI

    client = OpenAI(api_key=os.getenv("OPENAI_API_KEY"))
    started = time.perf_counter()
    response = client.chat.completions.create(
        model=settings.model,
        messages=[
            {"role": "system", "content": system_prompt},
            {
                "role": "user",
                "content": json.dumps(user_payload, ensure_ascii=False, default=str),
            },
        ],
        response_format={
            "type": "json_schema",
            "json_schema": {
                "name": schema_name,
                "strict": True,
                "schema": schema,
            },
        },
    )
    latency_ms = int((time.perf_counter() - started) * 1000)
    content = response.choices[0].message.content or "{}"
    usage = response.usage
    return AiCallResult(
        data=json.loads(content),
        prompt_tokens=int(getattr(usage, "prompt_tokens", 0) or 0),
        completion_tokens=int(getattr(usage, "completion_tokens", 0) or 0),
        total_tokens=int(getattr(usage, "total_tokens", 0) or 0),
        latency_ms=latency_ms,
        model=settings.model,
    )
