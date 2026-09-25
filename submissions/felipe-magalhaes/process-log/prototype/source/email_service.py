from __future__ import annotations

import json
import os
from urllib.request import Request, urlopen


class ResendTransport:
    endpoint = "https://api.resend.com/emails"

    def send(self, api_key: str, payload: dict) -> dict:
        payload = payload.copy()
        idempotency_key = payload.pop("_idempotency_key", None)
        headers = {"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"}
        if idempotency_key:
            headers["Idempotency-Key"] = idempotency_key
        request = Request(
            self.endpoint,
            data=json.dumps(payload).encode("utf-8"),
            headers=headers,
            method="POST",
        )
        with urlopen(request, timeout=15) as response:
            return json.loads(response.read().decode("utf-8"))


class EmailService:
    def __init__(self, api_key=None, sender=None, transport=None):
        self.api_key = api_key or os.getenv("RESEND_API_KEY")
        self.sender = sender or os.getenv("RESEND_FROM_EMAIL")
        self.transport = transport or ResendTransport()

    @property
    def is_configured(self) -> bool:
        return bool(self.api_key and self.sender)

    def send_digest(self, recipient: str, digest: dict, idempotency_key=None) -> dict:
        if not self.is_configured:
            raise RuntimeError("Envio desabilitado: configure RESEND_API_KEY e RESEND_FROM_EMAIL.")
        payload = {
            "from": self.sender,
            "to": [recipient],
            "subject": digest["subject"],
            "html": digest["html"],
            "text": digest["text"],
        }
        if idempotency_key:
            payload["_idempotency_key"] = idempotency_key
        return self.transport.send(self.api_key, payload)
