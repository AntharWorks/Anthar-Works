'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import Script from 'next/script';
import { FormEvent, useEffect, useState } from 'react';

type Product = {
  id: string;
  brand: string;
  model: string;
  variant: string | null;
  priceInr: string;
};

type CheckoutResponse = {
  orderId: string;
  orderNo: string;
  amountInr: number;
  customerNo: string;
  razorpay: { razorpayOrderId: string; keyId: string | null; testMode: boolean };
};

declare global {
  interface Window {
    Razorpay?: new (options: object) => { open: () => void };
  }
}

export default function CheckoutPage() {
  const { productId } = useParams<{ productId: string }>();
  const [product, setProduct] = useState<Product | null>(null);
  const [qty, setQty] = useState(1);
  const [form, setForm] = useState({ name: '', phone: '', address: '', pincode: '', city: '' });
  const [pending, setPending] = useState<CheckoutResponse | null>(null);
  const [paid, setPaid] = useState<{ orderNo: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch('/api/v1/products')
      .then((r) => r.json())
      .then((all: Product[]) => setProduct(all.find((p) => p.id === productId) ?? null))
      .catch(() => setError('Could not load product'));
  }, [productId]);

  async function confirmPayment(
    order: CheckoutResponse,
    payment: { razorpayPaymentId: string; razorpaySignature: string },
  ) {
    const res = await fetch(`/api/v1/checkout/${order.orderId}/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        razorpayOrderId: order.razorpay.razorpayOrderId,
        ...payment,
      }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data?.message ?? 'Payment confirmation failed');
    setPaid({ orderNo: data.orderNo });
    setPending(null);
  }

  async function startCheckout(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch('/api/v1/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          address: form.address || undefined,
          pincode: form.pincode || undefined,
          city: form.city || undefined,
          items: [{ productId, qty }],
        }),
      });
      const order: CheckoutResponse & { message?: string } = await res.json();
      if (!res.ok) throw new Error((order as any).message ?? 'Checkout failed');

      if (order.razorpay.testMode) {
        setPending(order);
        return;
      }

      if (!window.Razorpay) throw new Error('Payment library failed to load');
      const rzp = new window.Razorpay({
        key: order.razorpay.keyId,
        order_id: order.razorpay.razorpayOrderId,
        amount: Math.round(order.amountInr * 100),
        currency: 'INR',
        name: 'Anthar Works',
        description: `${product?.brand} ${product?.model}`,
        prefill: { name: form.name, contact: form.phone },
        handler: (response: {
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) =>
          confirmPayment(order, {
            razorpayPaymentId: response.razorpay_payment_id,
            razorpaySignature: response.razorpay_signature,
          }).catch((err) => setError(err.message)),
      });
      rzp.open();
    } catch (err: any) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  if (paid) {
    return (
      <main className="mx-auto max-w-lg px-6 py-24 text-center">
        <div className="text-5xl">✅</div>
        <h1 className="mt-4 text-2xl font-bold">Payment successful</h1>
        <p className="mt-2 text-slate-600">
          Order <span className="font-mono font-semibold">{paid.orderNo}</span> is
          confirmed. You&apos;ll receive delivery and installation updates on
          WhatsApp & SMS.
        </p>
        <Link href="/products" className="mt-6 inline-block text-blue-600 hover:underline">
          Continue shopping
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-lg px-6 py-12">
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <Link href="/products" className="text-sm text-blue-600 hover:underline">
        ← Back to catalog
      </Link>
      <h1 className="mt-2 text-2xl font-bold">Checkout</h1>

      {product ? (
        <div className="mt-4 flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4">
          <div>
            <p className="text-sm text-slate-500">{product.brand}</p>
            <p className="font-semibold">
              {product.model}
              {product.variant ? ` · ${product.variant}` : ''}
            </p>
          </div>
          <div className="text-right">
            <p className="text-lg font-bold">
              ₹{(Number(product.priceInr) * qty).toLocaleString('en-IN')}
            </p>
            <label className="text-sm text-slate-500">
              Qty{' '}
              <select
                value={qty}
                onChange={(e) => setQty(Number(e.target.value))}
                className="rounded border border-slate-300 px-1 py-0.5"
              >
                {[1, 2, 3, 4, 5].map((n) => (
                  <option key={n} value={n}>
                    {n}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </div>
      ) : (
        <p className="mt-4 text-slate-500">Loading product…</p>
      )}

      {pending ? (
        <div className="mt-6 rounded-xl border border-amber-300 bg-amber-50 p-5">
          <p className="font-semibold text-amber-800">Test mode</p>
          <p className="mt-1 text-sm text-amber-700">
            Razorpay keys are not configured on this server, so order{' '}
            <span className="font-mono">{pending.orderNo}</span> was created in
            simulated mode.
          </p>
          <button
            onClick={() =>
              confirmPayment(pending, {
                razorpayPaymentId: `pay_dev_${Date.now()}`,
                razorpaySignature: 'dev',
              }).catch((err) => setError(err.message))
            }
            className="mt-3 rounded-lg bg-amber-600 px-4 py-2 font-medium text-white hover:bg-amber-700"
          >
            Simulate successful payment
          </button>
        </div>
      ) : (
        <form onSubmit={startCheckout} className="mt-6 space-y-3">
          <input
            placeholder="Full name"
            value={form.name}
            onChange={(e) => setForm({ ...form, name: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
          <input
            placeholder="Mobile number (10 digits)"
            value={form.phone}
            maxLength={10}
            inputMode="numeric"
            onChange={(e) => setForm({ ...form, phone: e.target.value.trim() })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
          <input
            placeholder="Delivery address"
            value={form.address}
            onChange={(e) => setForm({ ...form, address: e.target.value })}
            className="w-full rounded-lg border border-slate-300 px-3 py-2"
            required
          />
          <div className="flex gap-3">
            <input
              placeholder="Pincode"
              value={form.pincode}
              maxLength={6}
              inputMode="numeric"
              onChange={(e) => setForm({ ...form, pincode: e.target.value.trim() })}
              className="w-1/2 rounded-lg border border-slate-300 px-3 py-2"
              required
            />
            <input
              placeholder="City"
              value={form.city}
              onChange={(e) => setForm({ ...form, city: e.target.value })}
              className="w-1/2 rounded-lg border border-slate-300 px-3 py-2"
            />
          </div>
          <button
            disabled={busy || !product}
            className="w-full rounded-lg bg-blue-600 py-3 font-medium text-white hover:bg-blue-700 disabled:opacity-50"
          >
            {busy ? 'Creating order…' : 'Pay with Razorpay'}
          </button>
          {error && <p className="text-sm text-rose-600">{error}</p>}
        </form>
      )}
    </main>
  );
}
