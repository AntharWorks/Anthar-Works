'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { DropletMark } from '@/components/Logo';
import { StoreLayout } from '@/components/store/StoreLayout';

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
    <StoreLayout>
      <div className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="max-w-2xl">
          <h1 className="page-title text-3xl sm:text-4xl">Water Purifiers</h1>
          <p className="mt-2 text-slate-600">
            Browse purifiers across brands — secure checkout, doorstep
            installation and warranty tracking included.
          </p>
        </div>

        <div className="mt-10 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {products === null &&
            Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="card overflow-hidden">
                <div className="h-36 animate-pulse bg-slate-100" />
                <div className="space-y-3 p-5">
                  <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
                  <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
                  <div className="h-9 w-full animate-pulse rounded-lg bg-slate-100" />
                </div>
              </div>
            ))}

          {products?.map((p) => (
            <div key={p.id} className="card card-hover group overflow-hidden">
              <div className="relative flex h-36 items-center justify-center overflow-hidden bg-gradient-to-br from-brand-50 to-sky-50">
                <DropletMark className="h-16 w-16 transition group-hover:scale-110" />
              </div>
              <div className="p-5">
                <p className="text-xs font-semibold uppercase tracking-wide text-brand-600">
                  {p.brand}
                </p>
                <h2 className="mt-1 text-lg font-semibold text-slate-900">
                  {p.model}
                  {p.variant ? (
                    <span className="text-slate-400"> · {p.variant}</span>
                  ) : null}
                </h2>
                <p className="mt-2 text-2xl font-bold text-slate-900">
                  ₹{Number(p.priceInr).toLocaleString('en-IN')}
                </p>
                <Link
                  href={`/checkout/${p.id}`}
                  className="btn btn-primary mt-4 w-full"
                >
                  Buy now
                </Link>
              </div>
            </div>
          ))}

          {products?.length === 0 && (
            <div className="card col-span-full p-10 text-center">
              <DropletMark className="mx-auto h-10 w-10 opacity-60" />
              <p className="mt-3 font-medium text-slate-600">
                Catalog is being stocked
              </p>
              <p className="mt-1 text-sm text-slate-400">
                Check back soon — new purifiers are on the way.
              </p>
            </div>
          )}
        </div>
      </div>
    </StoreLayout>
  );
}
