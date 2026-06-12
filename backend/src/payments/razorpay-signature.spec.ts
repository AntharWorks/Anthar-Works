import { createHmac } from 'crypto';
import {
  verifyPaymentSignature,
  verifyWebhookSignature,
} from './razorpay-signature';

const KEY_SECRET = 'test_key_secret';
const WEBHOOK_SECRET = 'test_webhook_secret';

describe('razorpay signature verification', () => {
  it('accepts a valid payment signature', () => {
    const orderId = 'order_ABC123';
    const paymentId = 'pay_XYZ789';
    const signature = createHmac('sha256', KEY_SECRET)
      .update(`${orderId}|${paymentId}`)
      .digest('hex');

    expect(
      verifyPaymentSignature({
        razorpayOrderId: orderId,
        razorpayPaymentId: paymentId,
        signature,
        keySecret: KEY_SECRET,
      }),
    ).toBe(true);
  });

  it('rejects a tampered payment signature', () => {
    expect(
      verifyPaymentSignature({
        razorpayOrderId: 'order_ABC123',
        razorpayPaymentId: 'pay_XYZ789',
        signature: 'deadbeef'.repeat(8),
        keySecret: KEY_SECRET,
      }),
    ).toBe(false);
  });

  it('accepts a valid webhook signature over the raw body', () => {
    const rawBody = JSON.stringify({
      event: 'payment.captured',
      payload: { payment: { entity: { id: 'pay_1', order_id: 'order_1' } } },
    });
    const signature = createHmac('sha256', WEBHOOK_SECRET)
      .update(rawBody)
      .digest('hex');

    expect(
      verifyWebhookSignature({
        rawBody,
        signature,
        webhookSecret: WEBHOOK_SECRET,
      }),
    ).toBe(true);
  });

  it('rejects a webhook whose body was modified after signing', () => {
    const signature = createHmac('sha256', WEBHOOK_SECRET)
      .update('{"event":"payment.captured"}')
      .digest('hex');

    expect(
      verifyWebhookSignature({
        rawBody: '{"event":"payment.captured","amount":999999}',
        signature,
        webhookSecret: WEBHOOK_SECRET,
      }),
    ).toBe(false);
  });
});
