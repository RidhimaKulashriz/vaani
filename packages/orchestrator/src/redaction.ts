const EMAIL_PATTERN = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;
const PHONE_PATTERN = /(?<![\w])(?:\+?\d[\d\s().-]{6,}\d)(?![\w])/g;
const LONG_CODE_PATTERN = /\b\d{4,8}\b/g;

export function redactPii(input: string): string {
  return input
    .replace(EMAIL_PATTERN, "[email]")
    .replace(PHONE_PATTERN, "[phone]")
    .replace(LONG_CODE_PATTERN, "[code]");
}

export function redactLogFields<T extends Record<string, unknown>>(fields: T): T {
  const safe = { ...fields };
  for (const key of Object.keys(safe)) {
    if (/phone|number|email|token|secret|code/i.test(key)) safe[key as keyof T] = "[redacted]" as T[keyof T];
    else if (typeof safe[key] === "string") safe[key as keyof T] = redactPii(safe[key] as string) as T[keyof T];
  }
  return safe;
}
