#!/usr/bin/env python3
"""
Preprocesa datos abiertos (openfootball, worldCupHistory, buffer Mongo) a JSONL
para el pipeline HDF5 de Cerebras Model Zoo.
"""
from __future__ import annotations

import json
import re
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
RAW_DIR = ROOT / "data" / "raw"
BUFFER_DIR = ROOT / "data" / "buffer"
HISTORY_PATH = ROOT.parent / "backend" / "src" / "data" / "worldCupHistory.json"
OPENFOOTBALL_BASE = (
    "https://raw.githubusercontent.com/openfootball/worldcup/master"
)

KNOCKOUT_PHASES = {
    "round of 16",
    "quarter-finals",
    "quarterfinals",
    "semi-finals",
    "semifinals",
    "third place",
    "final",
}


def load_json(path: Path):
    if not path.exists():
        return None
    with path.open(encoding="utf-8") as f:
        return json.load(f)


def download_openfootball_year(year: int) -> list[dict]:
    url = f"{OPENFOOTBALL_BASE}/{year}/worldcup.{year}.json"
    try:
        with urllib.request.urlopen(url, timeout=30) as resp:
            data = json.loads(resp.read().decode("utf-8"))
    except Exception as exc:  # noqa: BLE001
        print(f"skip openfootball {year}: {exc}")
        return []

    rounds = data.get("rounds") or data.get("matches") or []
    records = []
    for block in rounds:
        phase = str(block.get("name") or block.get("round") or "group").lower()
        for match in block.get("matches") or []:
            team1 = match.get("team1") or match.get("home") or {}
            team2 = match.get("team2") or match.get("away") or {}
            score = match.get("score") or {}
            if score.get("ft") is None and score.get("score1") is None:
                continue
            ft = score.get("ft")
            if ft and len(ft) >= 2:
                home_goals, away_goals = int(ft[0]), int(ft[1])
            else:
                home_goals = int(score.get("score1") or 0)
                away_goals = int(score.get("score2") or 0)

            home_name = team1.get("name") if isinstance(team1, dict) else str(team1)
            away_name = team2.get("name") if isinstance(team2, dict) else str(team2)

            weight = sample_weight_for_phase(phase, year)
            prompt = (
                f"Mundial {year} · fase {phase}\n"
                f"Local: {home_name}\nVisitante: {away_name}\n"
                f"Predice marcador final a 90 minutos."
            )
            records.append(
                {
                    "prompt": prompt,
                    "completion": f"{home_goals}-{away_goals}",
                    "sample_weight": weight,
                    "metadata": {
                        "source": "openfootball",
                        "tournament": year,
                        "phase": phase,
                        "home": home_name,
                        "away": away_name,
                        "goal_timings": [],
                    },
                }
            )
    return records


def sample_weight_for_phase(phase: str, year: int, mse_error: float = 0.0) -> float:
    weight = 1.0
    if any(k in phase for k in KNOCKOUT_PHASES):
        weight *= 2.0
    if year >= 2026:
        weight *= 1.5
    if mse_error > 0:
        weight *= 1.0 + mse_error
    return round(weight, 4)


def records_from_history() -> list[dict]:
    history = load_json(HISTORY_PATH)
    if not history:
        return []
    records = []
    finals = history.get("finals") or history.get("winners") or []
    for entry in finals:
        year = entry.get("year")
        if not year:
            continue
        score = entry.get("score") or entry.get("finalScore")
        if not score:
            continue
        m = re.match(r"(\d+)\s*[-–]\s*(\d+)", str(score))
        if not m:
            continue
        home_goals, away_goals = int(m.group(1)), int(m.group(2))
        champion = entry.get("champion") or entry.get("winner") or "?"
        runner = entry.get("runnerUp") or entry.get("runner_up") or "?"
        prompt = (
            f"Final Mundial {year}\nCampeón: {champion}\nSubcampeón: {runner}\n"
            f"Predice marcador final a 90 minutos."
        )
        records.append(
            {
                "prompt": prompt,
                "completion": f"{home_goals}-{away_goals}",
                "sample_weight": sample_weight_for_phase("final", int(year)),
                "metadata": {
                    "source": "worldCupHistory",
                    "tournament": int(year),
                    "phase": "final",
                    "goal_timings": [],
                },
            }
        )
    return records


def records_from_buffer() -> list[dict]:
    records = []
    if not BUFFER_DIR.exists():
        return records
    for path in sorted(BUFFER_DIR.glob("*.jsonl")):
        with path.open(encoding="utf-8") as f:
            for line in f:
                line = line.strip()
                if not line:
                    continue
                row = json.loads(line)
                mse = float(row.get("mseError") or 0)
                meta = row.get("metadata") or {}
                phase = str(meta.get("phase") or "mundial2026").lower()
                weight = sample_weight_for_phase(phase, 2026, mse_error=mse)
                records.append(
                    {
                        "prompt": row.get("prompt") or "",
                        "completion": row.get("completion") or "",
                        "sample_weight": weight,
                        "metadata": meta,
                    }
                )
    return records


def main() -> None:
    RAW_DIR.mkdir(parents=True, exist_ok=True)
    all_records: list[dict] = []

    for year in range(1930, 2023, 4):
        all_records.extend(download_openfootball_year(year))

    all_records.extend(records_from_history())
    all_records.extend(records_from_buffer())

    out_train = RAW_DIR / "oracle_train.jsonl"
    out_valid = RAW_DIR / "oracle_valid.jsonl"

    split_idx = max(1, int(len(all_records) * 0.9))
    train_rows = all_records[:split_idx]
    valid_rows = all_records[split_idx:]

    with out_train.open("w", encoding="utf-8") as f:
        for row in train_rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    with out_valid.open("w", encoding="utf-8") as f:
        for row in valid_rows:
            f.write(json.dumps(row, ensure_ascii=False) + "\n")

    print(f"Wrote {len(train_rows)} train + {len(valid_rows)} valid rows to {RAW_DIR}")


if __name__ == "__main__":
    main()
