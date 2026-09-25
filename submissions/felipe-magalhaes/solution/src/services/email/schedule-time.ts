import type { EmailFrequency } from "./email-types";

export const EMAIL_TIMEZONE = "America/Sao_Paulo" as const;
export const DEFAULT_SEND_TIME = "08:00";

function parts(date: Date) {
  const result = Object.fromEntries(new Intl.DateTimeFormat("en-US", {
    timeZone: EMAIL_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date).filter((part) => part.type !== "literal").map((part) => [part.type, Number(part.value)]));
  return { year: result.year, month: result.month, day: result.day, hour: result.hour, minute: result.minute };
}

function utcForLocal(year: number, month: number, day: number, hour: number, minute: number) {
  const desired = Date.UTC(year, month - 1, day, hour, minute);
  let guess = desired + 3 * 60 * 60 * 1000;
  for (let attempt = 0; attempt < 3; attempt++) {
    const actual = parts(new Date(guess));
    const represented = Date.UTC(actual.year, actual.month - 1, actual.day, actual.hour, actual.minute);
    guess += desired - represented;
  }
  return new Date(guess);
}

export function nextRunAt(input: { frequency: EmailFrequency; sendTime: string; weekday: number | null; dayOfMonth: number | null }, after: Date): string {
  const [hour, minute] = input.sendTime.split(":").map(Number);
  if (!Number.isInteger(hour) || hour < 0 || hour > 23 || !Number.isInteger(minute) || minute < 0 || minute > 59) throw new Error("Horário inválido.");
  const local = parts(after);
  for (let offset = 0; offset <= 370; offset++) {
    const day = new Date(Date.UTC(local.year, local.month - 1, local.day + offset, 12));
    const year = day.getUTCFullYear(), month = day.getUTCMonth() + 1, date = day.getUTCDate();
    if (input.frequency === "weekly" && day.getUTCDay() !== (input.weekday ?? 1)) continue;
    const last = new Date(Date.UTC(year, month, 0)).getUTCDate();
    if (input.frequency === "monthly" && date !== Math.min(input.dayOfMonth ?? 1, last)) continue;
    const candidate = utcForLocal(year, month, date, hour, minute);
    if (candidate.getTime() > after.getTime()) return candidate.toISOString();
  }
  throw new Error("Não foi possível calcular o próximo envio.");
}
