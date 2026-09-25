import pandas as pd

from digest_service import generate_priority_digest
from email_service import EmailService


def sample_frame():
    return pd.DataFrame(
        [
            {
                "opportunity_id": f"OP-{index}",
                "account": f"Conta {index}",
                "Priority Score": score,
                "Confidence": "MEDIUM",
                "Score Basis": "MODEL_FULL",
                "age_days": 20 + index,
                "sales_price": 1000 * index,
                "Action Tag": "ACTION_WORK_NOW",
                "next_task": "Fazer contato",
                "next_task_due": pd.NaT,
                "reason": "Explicação completa existente.",
            }
            for index, score in enumerate([70, 99, 85, 91, 60, 95], 1)
        ]
    )


def test_digest_uses_existing_top_scores():
    digest = generate_priority_digest(sample_frame())
    assert [item["score"] for item in digest["items"]] == [99, 95, 91, 85, 70]
    assert all(item["reason"] and item["action"] and item["next_task"] for item in digest["items"])
    assert "Onde focar, por que e o que fazer" in digest["text"]


def test_email_adapter_without_real_credentials():
    class MockTransport:
        def __init__(self):
            self.call = None

        def send(self, api_key, payload):
            self.call = (api_key, payload)
            return {"id": "mock-email-id"}

    transport = MockTransport()
    service = EmailService(api_key="test-key", sender="prioridades@example.com", transport=transport)
    result = service.send_digest("vendedor@example.com", generate_priority_digest(sample_frame()))
    assert result == {"id": "mock-email-id"}
    assert transport.call[1]["to"] == ["vendedor@example.com"]
    assert not EmailService(api_key="", sender="", transport=transport).is_configured


if __name__ == "__main__":
    test_digest_uses_existing_top_scores()
    test_email_adapter_without_real_credentials()
    print("DIGEST + EMAIL ADAPTER PASS")
