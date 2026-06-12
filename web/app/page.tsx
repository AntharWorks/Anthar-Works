import Link from 'next/link';

export default function StorefrontHome() {
  return (
    <main className="mx-auto flex max-w-4xl flex-col items-center gap-6 px-6 py-24 text-center">
      <h1 className="text-4xl font-bold tracking-tight">
        Anthar Works
      </h1>
      <p className="max-w-xl text-lg text-slate-600">
        Multi-brand water purifier marketplace — subscriptions, purchases,
        doorstep installation and warranty-backed service.
      </p>
      <div className="flex gap-4">
        <Link
          href="/products"
          className="rounded-lg bg-blue-600 px-5 py-2.5 font-medium text-white hover:bg-blue-700"
        >
          Browse purifiers
        </Link>
        <Link
          href="/portal"
          className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium hover:bg-slate-100"
        >
          Staff portal
        </Link>
      </div>
      <p className="text-sm text-slate-400">
        Storefront catalog, cart and Razorpay checkout land in Phase 3.
      </p>
    </main>
  );
}
