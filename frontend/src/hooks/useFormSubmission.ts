import { useState } from "react";

export function useFormSubmission<T>(submit: (data: T) => Promise<unknown>) {
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<unknown>(null);

  async function send(data: T): Promise<boolean> {
    if (submitting) return false;
    setSubmitting(true);
    setSuccess(false);
    setError(null);
    setResult(null);
    try {
      const response = await submit(data);
      setResult(response);
      setSuccess(true);
      return true;
    } catch {
      setError("We could not submit your request. Please check your details and try again.");
      return false;
    } finally {
      setSubmitting(false);
    }
  }

  return { submitting, success, error, result, send };
}