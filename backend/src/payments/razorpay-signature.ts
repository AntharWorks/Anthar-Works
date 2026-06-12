import { createHmac, timingSafeEqual } from 'crypto';

function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  return bufA.length === bufB.length && timingSafeEqual(bufA, bufB);
}

// Checkout callback: HMAC-SHA256(order_id + "|" + payment_id, key_secret).
export function verifyPaymentSignature(params: {
  razorpayOrderId: string;
  razorpayPaymentId: string;
  signature: string;
  keySecret: string;
}): boolean {
  const expected = createHmac('sha256', params.keySecret)
    .update(`${params.razorpayOrderId}|${params.razorpayPaymentId}`)
    .digest('hex');
  return safeEqual(expected, params.signature);
}

// Webhook: HMAC-SHA256 of the raw request body with the webhook secret.
export function verifyWebhookSignature(params: {
  rawBody: Buffer | string;
  signature: string;
  webhookSecret: string;
}): boolean {
  const expected = createHmac('sha256', params.webhookSecret)
    .update(params.rawBody)
    .digest('hex');
  return safeEqual(expected, params.signature);
}
