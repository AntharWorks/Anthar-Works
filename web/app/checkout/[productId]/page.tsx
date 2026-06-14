'use client';

import Link from 'next/link';
import { useParams } from 'next/navigation';
import Script from 'next/script';
import { FormEvent, useEffect, useState } from 'react';
import { DropletMark } from '@/components/Logo';
import { StoreLayout } from '@/components/store/StoreLayout';

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
  mode: 'online' | 'offline';
  razorpay?: { razorpayOrderId: string; keyId: string };
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
  const [paid, setPaid] = useState<{ orderNo: string } | null>(null);
  const [placed, setPlaced] = useState<{ orderNo: string } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [paymentsLive, setPaymentsLive] = useState(true);

  useEffect(() => {
    fetch('/api/v1/products')
      .then((r) => r.json())
      .then((all: Product[]) => setProduct(all.find((p) => p.id === productId) ?? null))
      .catch(() => setError('Could not load product'));
    fetch('/api/v1/settings/public')
      .then((r) => r.json())
      .then((s: { paymentsLive: boolean }) => setPaymentsLive(s.paymentsLive))
      .catch(() => {});
  }, [productId]);

  async function confirmPayment(
    order: CheckoutResponse,
    payment: { razorpayPaymentId: string; razorpaySignature: string },
  ) {
    if (!order.razorpay) return;
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

      // Offline mode: online payments are off — the order is recorded and our
      // team collects payment and confirms installation.
      if (order.mode === 'offline' || !order.razorpay) {
        setPlaced({ orderNo: order.orderNo });
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

  if (paid || placed) {
    const offline = Boolean(placed);
    const orderNo = (paid ?? placed)!.orderNo;
    return (
      <StoreLayout>
        <div className="mx-auto max-w-lg px-4 py-20 text-center sm:px-6">
          <div
            className={`mx-auto flex h-16 w-16 items-center justify-center rounded-full ${
              offline ? 'bg-brand-50 text-brand-600' : 'bg-emerald-50 text-emerald-600'
            }`}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-8 w-8">
              <path d="m5 13 4 4L19 7" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </div>
          <h1 className="mt-5 page-title text-2xl">
            {offline ? 'Order placed' : 'Payment successful'}
          </h1>
          <p className="mt-2 text-slate-600">
            {offline ? (
              <>
                Your order <span className="font-mono font-semibold">{orderNo}</span> is
                recorded. Our team will contact you shortly to collect payment and
                confirm your installation.
              </>
            ) : (
              <>
                Order <span className="font-mono font-semibold">{orderNo}</span> is
                confirmed. You&apos;ll receive delivery and installation updates on
                WhatsApp &amp; SMS.
              </>
            )}
          </p>
          <Link href="/products" className="btn btn-primary mt-7">
            Continue shopping
          </Link>
        </div>
      </StoreLayout>
    );
  }

  return (
    <StoreLayout>
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="afterInteractive" />
      <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
        <Link href="/products" className="text-sm font-medium text-brand-700 hover:text-brand-800">
          ← Back to catalog
        </Link>
        <h1 className="mt-3 page-title">Checkout</h1>

        {product ? (
          <div className="card mt-5 flex items-center justify-between p-4">
            <div className="flex items-center gap-3">
              <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gradient-to-br from-brand-50 to-sky-50">
                <DropletMark className="h-7 w-7" />
              </span>
              <div>
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  {product.brand}
                </p>
                <p className="font-semibold text-slate-900">
                  {product.model}
                  {product.variant ? ` · ${product.variant}` : ''}
                </p>
              </div>
            </div>
            <div className="text-right">
              <p className="text-lg font-bold text-slate-900">
                ₹{(Number(product.priceInr) * qty).toLocaleString('en-IN')}
              </p>
              <label className="text-sm text-slate-500">
                Qty{' '}
                <select
                  value={qty}
                  onChange={(e) => setQty(Number(e.target.value))}
                  className="rounded-lg border border-slate-300 px-1.5 py-0.5"
                >
                  {[1, 2, 3, 4, 5].map((n) => (
                    <option key={n} value={n}>{n}</option>
                  ))}
                </select>
              </label>
            </div>
          </div>
        ) : (
          <p className="mt-5 text-slate-500">Loading product…</p>
        )}

        <form onSubmit={startCheckout} className="card mt-5 space-y-4 p-5 sm:p-6">
          <div>
            <label className="label">Full name</label>
            <input
              placeholder="Your name"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Mobile number</label>
            <input
              placeholder="10-digit mobile"
              value={form.phone}
              maxLength={10}
              inputMode="numeric"
              onChange={(e) => setForm({ ...form, phone: e.target.value.trim() })}
              className="input"
              required
            />
          </div>
          <div>
            <label className="label">Delivery address</label>
            <input
              placeholder="House, street, area"
              value={form.address}
              onChange={(e) => setForm({ ...form, address: e.target.value })}
              className="input"
              required
            />
          </div>
          <div className="flex gap-3">
            <div className="w-1/2">
              <label className="label">Pincode</label>
              <input
                placeholder="560001"
                value={form.pincode}
                maxLength={6}
                inputMode="numeric"
                onChange={(e) => setForm({ ...form, pincode: e.target.value.trim() })}
                className="input"
                required
              />
            </div>
            <div className="w-1/2">
              <label className="label">City</label>
              <input
                placeholder="City"
                value={form.city}
                onChange={(e) => setForm({ ...form, city: e.target.value })}
                className="input"
              />
            </div>
          </div>
          <button disabled={busy || !product} className="btn btn-primary btn-lg w-full">
            {busy ? 'Creating order…' : paymentsLive ? 'Pay with Razorpay' : 'Place order'}
          </button>
          {!paymentsLive && (
            <p className="text-center text-xs text-slate-500">
              Online payment isn&apos;t enabled yet — place your order and our team
              will contact you to collect payment.
            </p>
          )}
          {error && <p className="text-center text-sm text-rose-600">{error}</p>}
        </form>
      </div>
    </StoreLayout>
  );
}
