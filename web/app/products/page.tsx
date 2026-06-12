'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';

type Product = {
  id: string;
  brand: string;
  model: string;
  variant: string | null;
  priceInr: string;
};

export default function PublicCatalogPage() {
  const [products, setProducts] = useState<Product[] | null>(null);

  useEffect(() => {
    fetch('/api/v1/products')
      .then((r) => r.json())
      .then(setProducts)
      .catch(() => setProducts([]));
  }, []);

  return (
    <main className="mx-auto max-w-5xl px-6 py-12">
      <Link href="/" className="text-sm text-blue-600 hover:underline">
        ← Home
      </Link>
      <h1 className="mt-2 text-3xl font-bold">Water Purifiers</h1>
      <p className="mt-1 text-slate-600">
        Browse purifiers across brands — instant checkout with Razorpay.
      </p>

      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {products === null && <p className="text-slate-400">Loading catalog…</p>}
        {products?.map((p) => (
          <div
            key={p.id}
            className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
          >
            <div className="flex h-32 items-center justify-center rounded-lg bg-slate-100 text-4xl">
              💧
            </div>
            <p className="mt-4 text-sm font-medium text-slate-500">{p.brand}</p>
            <h2 className="text-lg font-semibold">
              {p.model}
              {p.variant ? ` · ${p.variant}` : ''}
            </h2>
            <p className="mt-1 text-xl font-bold">
              ₹{Number(p.priceInr).toLocaleString('en-IN')}
            </p>
            <Link
              href={`/checkout/${p.id}`}
              className="mt-3 block w-full rounded-lg bg-blue-600 py-2 text-center text-sm font-medium text-white hover:bg-blue-700"
            >
              Buy now
            </Link>
          </div>
        ))}
        {products?.length === 0 && (
          <p className="text-slate-400">Catalog is being stocked — check back soon.</p>
        )}
      </div>
    </main>
  );
}
