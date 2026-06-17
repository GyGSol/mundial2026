"""
Read hook MSE para cszoo data_preprocess — prioriza errores grandes y fases knockout.
Registro en YAML: read_hook: oracle_mse_read_hook
"""

from __future__ import annotations

KNOCKOUT_PHASES = (
    "round of 16",
    "quarter",
    "semi",
    "third place",
    "final",
    "knockout",
)


def _base_weight(metadata: dict | None) -> float:
    meta = metadata or {}
    weight = float(meta.get("sample_weight") or 1.0)
    phase = str(meta.get("phase") or "").lower()
    if any(k in phase for k in KNOCKOUT_PHASES):
        weight *= 2.0
    tournament = int(meta.get("tournament") or 0)
    if tournament >= 2026:
        weight *= 1.5
    mse = float(meta.get("mse_error") or meta.get("mseError") or 0)
    if mse > 0:
        weight *= 1.0 + mse
    return weight


def read_hook(record: dict, **kwargs) -> dict:
    """Transforma un registro JSONL en prompt/completion con peso MSE."""
    prompt = record.get("prompt") or record.get("input") or ""
    completion = record.get("completion") or record.get("output") or ""
    metadata = record.get("metadata") or {}

    return {
        "prompt": prompt,
        "completion": completion,
        "sample_weight": _base_weight(metadata),
        "metadata": metadata,
    }
