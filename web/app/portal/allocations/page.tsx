'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, getSessionUser } from '@/lib/api';

type StaffUser = { id: string; name: string; phone: string; role: string };
type Product = { id: string; brand: string; model: string };
type Allocation = {
  id: string;
  pincode: string | null;
  backend: StaffUser;
  product: Product | null;
};
type TechMapping = {
  id: string;
  backend: StaffUser;
  technician: StaffUser;
};

export default function AllocationsPage() {
  const isAdmin = getSessionUser()?.role === 'ADMIN';
  const [backends, setBackends] = useState<StaffUser[]>([]);
  const [technicians, setTechnicians] = useState<StaffUser[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [allocations, setAllocations] = useState<Allocation[]>([]);
  const [techMap, setTechMap] = useState<TechMapping[]>([]);
  const [error, setError] = useState<string | null>(null);

  const [allocForm, setAllocForm] = useState({
    backendId: '',
    mode: 'pincode' as 'pincode' | 'product',
    pincode: '',
    productId: '',
  });
  const [mapForm, setMapForm] = useState({ backendId: '', technicianId: '' });

  const load = useCallback(async () => {
    const [alloc, map] = await Promise.all([
      api<Allocation[]>('/allocations'),
      api<TechMapping[]>('/allocations/technician-map'),
    ]);
    setAllocations(alloc);
    setTechMap(map);
  }, []);

  useEffect(() => {
    load().catch((e) => setError(e.message));
    api<StaffUser[]>('/users?role=BACKEND').then(setBackends).catch(() => {});
    api<StaffUser[]>('/users?role=TECHNICIAN').then(setTechnicians).catch(() => {});
    api<Product[]>('/products').then(setProducts).catch(() => {});
  }, [load]);

  async function createAllocation(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/allocations', {
        method: 'POST',
        body: {
          backendId: allocForm.backendId,
          ...(allocForm.mode === 'pincode'
            ? { pincode: allocForm.pincode }
            : { productId: allocForm.productId }),
        },
      });
      setAllocForm({ ...allocForm, pincode: '', productId: '' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function mapTechnician(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/allocations/technician-map', { method: 'POST', body: mapForm });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function remove(path: string) {
    setError(null);
    try {
      await api(path, { method: 'DELETE' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Allocations</h1>
      <p className="mt-1 text-sm text-slate-500">
        Route customer data to backend staff by pincode or model, and assign
        each backend their technician set.
      </p>
      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Customer data → Backend staff</h2>

          {isAdmin && (
            <form onSubmit={createAllocation} className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
              <select
                value={allocForm.backendId}
                onChange={(e) => setAllocForm({ ...allocForm, backendId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
                required
              >
                <option value="">Select backend staff…</option>
                {backends.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.phone})
                  </option>
                ))}
              </select>
              <div className="flex gap-2">
                <select
                  value={allocForm.mode}
                  onChange={(e) =>
                    setAllocForm({ ...allocForm, mode: e.target.value as 'pincode' | 'product' })
                  }
                  className="rounded-lg border border-slate-300 px-2 py-1.5"
                >
                  <option value="pincode">By pincode</option>
                  <option value="product">By model</option>
                </select>
                {allocForm.mode === 'pincode' ? (
                  <input
                    placeholder="6-digit pincode"
                    value={allocForm.pincode}
                    maxLength={6}
                    onChange={(e) => setAllocForm({ ...allocForm, pincode: e.target.value.trim() })}
                    className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5"
                    required
                  />
                ) : (
                  <select
                    value={allocForm.productId}
                    onChange={(e) => setAllocForm({ ...allocForm, productId: e.target.value })}
                    className="flex-1 rounded-lg border border-slate-300 px-2 py-1.5"
                    required
                  >
                    <option value="">Select model…</option>
                    {products.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.brand} {p.model}
                      </option>
                    ))}
                  </select>
                )}
              </div>
              <button className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700">
                Allocate
              </button>
            </form>
          )}

          <ul className="mt-3 space-y-2 text-sm">
            {allocations.map((a) => (
              <li key={a.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <span>
                  <span className="font-medium">{a.backend.name}</span>
                  {' ← '}
                  {a.pincode ? (
                    <>pincode <span className="font-mono">{a.pincode}</span></>
                  ) : (
                    <>{a.product?.brand} {a.product?.model}</>
                  )}
                </span>
                {isAdmin && (
                  <button
                    onClick={() => remove(`/allocations/${a.id}`)}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
            {allocations.length === 0 && (
              <p className="text-slate-400">No allocations yet.</p>
            )}
          </ul>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <h2 className="font-semibold">Technician sets → Backend staff</h2>

          {isAdmin && (
            <form onSubmit={mapTechnician} className="mt-3 space-y-2 rounded-lg bg-slate-50 p-3 text-sm">
              <select
                value={mapForm.backendId}
                onChange={(e) => setMapForm({ ...mapForm, backendId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
                required
              >
                <option value="">Select backend staff…</option>
                {backends.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} ({b.phone})
                  </option>
                ))}
              </select>
              <select
                value={mapForm.technicianId}
                onChange={(e) => setMapForm({ ...mapForm, technicianId: e.target.value })}
                className="w-full rounded-lg border border-slate-300 px-2 py-1.5"
                required
              >
                <option value="">Select technician…</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.phone})
                  </option>
                ))}
              </select>
              <button className="rounded-lg bg-blue-600 px-3 py-1.5 font-medium text-white hover:bg-blue-700">
                Assign technician
              </button>
            </form>
          )}

          <ul className="mt-3 space-y-2 text-sm">
            {techMap.map((m) => (
              <li key={m.id} className="flex items-center justify-between rounded-lg bg-slate-50 p-3">
                <span>
                  <span className="font-medium">{m.backend.name}</span>
                  {' tracks '}
                  {m.technician.name}
                </span>
                {isAdmin && (
                  <button
                    onClick={() => remove(`/allocations/technician-map/${m.id}`)}
                    className="text-xs text-rose-600 hover:underline"
                  >
                    Remove
                  </button>
                )}
              </li>
            ))}
            {techMap.length === 0 && (
              <p className="text-slate-400">No technician assignments yet.</p>
            )}
          </ul>
        </section>
      </div>
    </div>
  );
}
