export type VerificationEmail = {
  recipient: string;
  verificationUrl: string;
};

export type EmailDeliveryResult = {
  delivered: boolean;
};

export async function sendVerificationEmail(_email: VerificationEmail): Promise<EmailDeliveryResult> {
  // Delivery stays disabled until a provider is configured; tokens are still stored for later delivery.
  return { delivered: false };
}
