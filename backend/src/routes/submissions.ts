import type { IncomingMessage, ServerResponse } from "node:http";
import { requirePool } from "../db/database.js";
import { sendVerificationEmail } from "../services/email.js";
import { createVerificationToken } from "../services/verification.js";
import { parseJsonBody, RequestBodyError } from "../utils/body.js";
import { sendCreated, sendError } from "../utils/response.js";

type JsonObject = Record<string, unknown>;
type ValidatedData = Record<string, string | number | null>;

const BLOOD_GROUPS = ["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-", "unknown"];
const URGENCIES = ["low", "medium", "high", "critical"];
const EMAIL_PATTERN = /^[^@\s]+@[^@\s]+\.[^@\s]+$/;
const PHONE_PATTERN = /^\+?[0-9 ()-]{10,22}$/;
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isObject(value: unknown): value is JsonObject {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function invalid(): never {
  throw new RequestBodyError(400, "VALIDATION_ERROR", "Invalid request");
}

function validateObject(value: unknown, allowed: string[]): JsonObject {
  if (!isObject(value) || Object.keys(value).some((key) => !allowed.includes(key))) invalid();
  return value;
}

function requiredString(data: JsonObject, key: string, maxLength = 500): string {
  if (typeof data[key] !== "string") invalid();
  const value = data[key].trim();
  if (!value || value.length > maxLength) invalid();
  return value;
}

function optionalString(data: JsonObject, key: string, maxLength = 500): string | null {
  if (data[key] === undefined || data[key] === null) return null;
  return requiredString(data, key, maxLength);
}

function email(data: JsonObject, key: string): string {
  const value = requiredString(data, key, 320);
  if (!EMAIL_PATTERN.test(value)) invalid();
  return value.toLowerCase();
}

function phone(data: JsonObject, key: string, required = true): string | null {
  const value = required ? requiredString(data, key, 20) : optionalString(data, key, 20);
  if (value !== null && (!PHONE_PATTERN.test(value) || value.replace(/\D/g, "").length < 10)) invalid();
  return value;
}

function college(data: JsonObject, key: string, required = false): string | null {
  const value = required ? requiredString(data, key, 300) : optionalString(data, key, 300);
  if (value !== null && (value.replace(/[^\p{L}]/gu, "").length < 3 || !/[\p{L}]{3}/u.test(value))) invalid();
  return value;
}

function oneOf(data: JsonObject, key: string, values: readonly string[]): string {
  const value = requiredString(data, key, 40);
  if (!values.includes(value)) invalid();
  return value;
}

function optionalOneOf(data: JsonObject, key: string, values: readonly string[]): string | null {
  if (data[key] === undefined || data[key] === null) return null;
  return oneOf(data, key, values);
}

function optionalUuid(data: JsonObject, key: string): string | null {
  const value = optionalString(data, key, 36);
  if (value !== null && !UUID_PATTERN.test(value)) invalid();
  return value;
}

function positiveInteger(data: JsonObject, key: string): number {
  if (typeof data[key] !== "number" || !Number.isSafeInteger(data[key]) || data[key] <= 0 || data[key] > 32767) invalid();
  return data[key];
}

function positiveAmount(data: JsonObject): number {
  if (typeof data.amount !== "number" || !Number.isFinite(data.amount) || data.amount <= 0 || data.amount > 10_000_000) invalid();
  return Math.round(data.amount * 100) / 100;
}

function validateVolunteer(body: unknown): ValidatedData {
  const data = validateObject(body, ["full_name", "email", "phone", "skills", "availability", "message", "chapter_id", "blood_group", "city", "college"]);
  return {
    full_name: requiredString(data, "full_name", 200),
    email: email(data, "email"),
    phone: phone(data, "phone"),
    skills: optionalString(data, "skills", 1000),
    availability: optionalString(data, "availability", 500),
    message: optionalString(data, "message", 2000),
    chapter_id: optionalUuid(data, "chapter_id"),
    blood_group: optionalOneOf(data, "blood_group", BLOOD_GROUPS),
    city: requiredString(data, "city", 200),
    college: college(data, "college", true),
  };
}

function validateMember(body: unknown): ValidatedData {
  const data = validateObject(body, ["full_name", "email", "phone", "membership_type", "message", "chapter_id", "blood_group", "city", "college"]);
  return {
    full_name: requiredString(data, "full_name", 200),
    email: email(data, "email"),
    phone: phone(data, "phone"),
    membership_type: oneOf(data, "membership_type", ["student", "general", "supporting"]),
    message: optionalString(data, "message", 2000),
    chapter_id: optionalUuid(data, "chapter_id"),
    blood_group: optionalOneOf(data, "blood_group", BLOOD_GROUPS),
    city: requiredString(data, "city", 200),
    college: college(data, "college", data.membership_type === "student"),
  };
}

function validateContact(body: unknown): ValidatedData {
  const data = validateObject(body, ["name", "email", "phone", "subject", "message"]);
  return {
    name: requiredString(data, "name", 200),
    email: email(data, "email"),
    phone: phone(data, "phone", false),
    subject: requiredString(data, "subject", 300),
    message: requiredString(data, "message", 5000),
  };
}

function validateEmergency(body: unknown): ValidatedData {
  const data = validateObject(body, ["name", "phone", "location", "emergency_type", "description", "urgency"]);
  return {
    name: requiredString(data, "name", 200),
    phone: phone(data, "phone"),
    location: requiredString(data, "location", 500),
    emergency_type: oneOf(data, "emergency_type", ["medical", "blood_requirement", "disaster", "accident", "other"]),
    description: requiredString(data, "description", 5000),
    urgency: optionalOneOf(data, "urgency", URGENCIES),
  };
}

function validateBloodRequest(body: unknown): ValidatedData {
  const data = validateObject(body, ["blood_group", "city", "hospital", "hospital_location", "units_required", "contact_name", "contact_phone", "urgency"]);
  return {
    blood_group: oneOf(data, "blood_group", BLOOD_GROUPS),
    city: requiredString(data, "city", 200),
    hospital: requiredString(data, "hospital", 300),
    hospital_location: optionalString(data, "hospital_location", 500),
    units_required: positiveInteger(data, "units_required"),
    contact_name: requiredString(data, "contact_name", 200),
    contact_phone: phone(data, "contact_phone"),
    urgency: optionalOneOf(data, "urgency", URGENCIES),
  };
}

function validateDonation(body: unknown): ValidatedData {
  const data = validateObject(body, ["donor_name", "email", "phone", "amount", "frequency", "purpose"]);
  return {
    donor_name: requiredString(data, "donor_name", 200),
    email: email(data, "email"),
    phone: phone(data, "phone", false),
    amount: positiveAmount(data),
    frequency: oneOf(data, "frequency", ["one_time", "monthly"]),
    purpose: oneOf(data, "purpose", ["general_support", "blood_donation", "disaster_relief", "health_camps"]),
  };
}

export async function handleSubmission(request: IncomingMessage, response: ServerResponse, resource: string): Promise<void> {
  let data: ValidatedData;
  try {
    const body = await parseJsonBody(request);
    data = resource === "volunteers" ? validateVolunteer(body)
      : resource === "members" ? validateMember(body)
      : resource === "contact" ? validateContact(body)
      : resource === "emergencies" ? validateEmergency(body)
      : resource === "blood-requests" ? validateBloodRequest(body)
      : validateDonation(body);
  } catch (error) {
    if (error instanceof RequestBodyError) {
      sendError(response, error.statusCode, error.message, error.code);
      return;
    }
    sendError(response, 400, "Invalid request", "VALIDATION_ERROR");
    return;
  }

  try {
    const database = requirePool();
    let result;
    let verification: { token: string; hash: string; expiresAt: Date } | null = null;
    if (resource === "volunteers" || resource === "members") verification = createVerificationToken();
    if (resource === "volunteers") {
      result = await database.query(
        "INSERT INTO volunteers (full_name, email, phone, skills, availability, message, chapter_id, blood_group, city, college, email_verification_token_hash, email_verification_expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id",
        [data.full_name, data.email, data.phone, data.skills, data.availability, data.message, data.chapter_id, data.blood_group, data.city, data.college, verification?.hash, verification?.expiresAt],
      );
    } else if (resource === "members") {
      result = await database.query(
        "INSERT INTO members (full_name, email, phone, membership_type, message, chapter_id, blood_group, city, college, email_verification_token_hash, email_verification_expires_at) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING id",
        [data.full_name, data.email, data.phone, data.membership_type, data.message, data.chapter_id, data.blood_group, data.city, data.college, verification?.hash, verification?.expiresAt],
      );
    } else if (resource === "contact") {
      result = await database.query(
        "INSERT INTO contact_messages (name, email, phone, subject, message) VALUES ($1, $2, $3, $4, $5) RETURNING id",
        [data.name, data.email, data.phone, data.subject, data.message],
      );
    } else if (resource === "emergencies") {
      result = await database.query(
        "INSERT INTO emergencies (name, phone, location, emergency_type, description, urgency) VALUES ($1, $2, $3, $4, $5, COALESCE($6, 'high')) RETURNING id",
        [data.name, data.phone, data.location, data.emergency_type, data.description, data.urgency],
      );
    } else if (resource === "blood-requests") {
      result = await database.query(
        "INSERT INTO blood_requests (blood_group, city, hospital, hospital_location, units_required, contact_name, contact_phone, urgency) VALUES ($1, $2, $3, $4, $5, $6, $7, COALESCE($8, 'high')) RETURNING id",
        [data.blood_group, data.city, data.hospital, data.hospital_location, data.units_required, data.contact_name, data.contact_phone, data.urgency],
      );
    } else {
      result = await database.query(
        "INSERT INTO donations (donor_name, email, phone, amount, frequency, purpose) VALUES ($1, $2, $3, $4, $5, $6) RETURNING id",
        [data.donor_name, data.email, data.phone, data.amount, data.frequency, data.purpose],
      );
    }
    if (verification) {
      const baseUrl = process.env.EMAIL_VERIFICATION_BASE_URL ?? "http://localhost:5000/api/verify-email";
      const delivery = await sendVerificationEmail({ recipient: data.email as string, verificationUrl: `${baseUrl}?token=${verification.token}` });
      sendCreated(response, { id: result.rows[0].id, emailVerification: { status: delivery.delivered ? "sent" : "not_configured" } });
      return;
    }
    sendCreated(response, { id: result.rows[0].id });
  } catch (error) {
    if (isUniqueViolation(error)) {
      sendError(response, 409, "An active application already exists for this email address.", "CONFLICT");
      return;
    }
    sendError(response, 500, "Internal server error");
  }
}

function isUniqueViolation(error: unknown): boolean {
  return typeof error === "object" && error !== null && "code" in error && error.code === "23505";
}