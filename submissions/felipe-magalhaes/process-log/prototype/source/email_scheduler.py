from __future__ import annotations

import argparse
import time

import pandas as pd

import crm_state as state
from digest_service import generate_priority_digest
from email_schedules import DIGEST_COLUMNS, apply_scope, due_schedules, finish_execution, reserve_execution
from email_service import EmailService


def process_due_schedules(now=None, email_service=None, frame_loader=None, path=state.DB_PATH):
    service = email_service or EmailService()
    schedules = due_schedules(now, path)
    result = {"due": len(schedules), "sent": 0, "failed": 0, "skipped": 0}
    if not service.is_configured:
        result["skipped"] = len(schedules)
        return result
    frame = frame_loader() if frame_loader else None
    for schedule in schedules:
        if not reserve_execution(schedule, path):
            result["skipped"] += 1
            continue
        try:
            scoped = (
                apply_scope(frame, schedule["scope_config"])
                if frame is not None
                else pd.DataFrame(schedule["scope_config"].get("digest_rows", []), columns=DIGEST_COLUMNS)
            )
            digest = generate_priority_digest(scoped)
            response = service.send_digest(
                schedule["recipient_email"], digest,
                idempotency_key=f"schedule-{schedule['id']}-{schedule['next_run_at']}",
            )
            finish_execution(schedule, result=response, now=now, path=path)
            result["sent"] += 1
        except Exception as exc:
            finish_execution(schedule, error=exc, now=now, path=path)
            result["failed"] += 1
    return result


def main():
    parser = argparse.ArgumentParser(description="Worker de resumos automáticos por e-mail")
    parser.add_argument("--once", action="store_true", help="Processa os agendamentos vencidos uma vez e encerra")
    parser.add_argument("--interval", type=int, default=60, help="Intervalo entre verificações, em segundos")
    args = parser.parse_args()
    while True:
        print(process_due_schedules(), flush=True)
        if args.once:
            break
        time.sleep(max(30, args.interval))


if __name__ == "__main__":
    main()
