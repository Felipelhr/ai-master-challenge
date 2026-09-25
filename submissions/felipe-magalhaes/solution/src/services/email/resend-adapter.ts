export interface EmailMessage { to: string; subject: string; html: string; text: string; idempotencyKey: string }
export interface EmailAdapter { send(message: EmailMessage): Promise<string> }

export function resendConfigured() { return Boolean(process.env.RESEND_API_KEY && process.env.RESEND_FROM_EMAIL); }

export class ResendEmailAdapter implements EmailAdapter {
  async send(message: EmailMessage): Promise<string> {
    const key = process.env.RESEND_API_KEY, from = process.env.RESEND_FROM_EMAIL;
    if (!key || !from) throw new Error("Configure RESEND_API_KEY e RESEND_FROM_EMAIL para enviar.");
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST", headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", "Idempotency-Key": message.idempotencyKey },
      body: JSON.stringify({ from, to: [message.to], subject: message.subject, html: message.html, text: message.text }),
      signal: AbortSignal.timeout(20_000),
    });
    const result = await response.json() as { id?: string; message?: string };
    if (!response.ok || !result.id) throw new Error(result.message ?? `Resend HTTP ${response.status}`);
    return result.id;
  }
}
