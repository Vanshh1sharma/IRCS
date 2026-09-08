export function text(form: FormData, name: string): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim() : "";
}

export function emailIsValid(value: string): boolean {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value);
}

export function phoneIsValid(value: string): boolean {
  return /^\+?[0-9 ()-]{10,22}$/.test(value) && value.replace(/\D/g, "").length >= 10;
}

export function collegeIsValid(value: string): boolean {
  return value.replace(/[^\p{L}]/gu, "").length >= 3;
}

export function normalizedEmail(value: string): string {
  return value.trim().toLowerCase();
}

export function formError(values: Record<string, string>, rules: { required: string[]; email?: string; phone?: string }): string | null {
  if (rules.required.some((name) => !values[name])) return "Please complete all required fields.";
  if (rules.email && !emailIsValid(values[rules.email])) return "Please enter a valid email address.";
  if (rules.phone && !phoneIsValid(values[rules.phone])) return "Please enter a valid phone number.";
  return null;
}