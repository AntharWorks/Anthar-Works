'use client';

import { FormEvent, useCallback, useEffect, useState } from 'react';
import { api, getSessionUser } from '@/lib/api';

type StaffUser = {
  id: string;
  name: string;
  phone: string;
  role: string;
  status: string;
  createdAt: string;
};

const STAFF_ROLES = ['BACKEND', 'TECHNICIAN', 'SALES', 'ADMIN'];

export default function StaffPage() {
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ name: '', phone: '', role: 'TECHNICIAN' });
  const isAdmin = getSessionUser()?.role === 'ADMIN';

  const load = useCallback(
    () => api<StaffUser[]>('/users').then((all) => setUsers(all.filter((u) => u.role !== 'CUSTOMER'))),
    [],
  );

  useEffect(() => {
    load().catch((e) => setError(e.message));
  }, [load]);

  async function toggleStatus(u: StaffUser) {
    setError(null);
    try {
      await api(`/users/${u.id}/status`, {
        method: 'PATCH',
        body: { status: u.status === 'ACTIVE' ? 'SUSPENDED' : 'ACTIVE' },
      });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  async function createLogin(e: FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api('/users', { method: 'POST', body: form });
      setForm({ name: '', phone: '', role: 'TECHNICIAN' });
      await load();
    } catch (err: any) {
      setError(err.message);
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-bold">Staff</h1>
      <p className="mt-1 text-sm text-slate-500">
        Mobile number is the login ID; staff sign in with an SMS OTP.
      </p>

      {isAdmin && (
        <form
          onSubmit={createLogin}
          className="mt-4 flex flex-wrap items-end gap-3 rounded-xl border border-slate-200 bg-white p-5"
        >
          <label className="text-sm font-medium">
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="text-sm font-medium">
            Mobile (login ID)
            <input
              value={form.phone}
              maxLength={10}
              onChange={(e) => setForm({ ...form, phone: e.target.value.trim() })}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2"
              required
            />
          </label>
          <label className="text-sm font-medium">
            Role
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="mt-1 block rounded-lg border border-slate-300 px-3 py-2"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button className="rounded-lg bg-blue-600 px-4 py-2 font-medium text-white hover:bg-blue-700">
            Create login
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="mt-4 overflow-hidden rounded-xl border border-slate-200 bg-white">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-left text-slate-500">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              {isAdmin && <th className="px-4 py-3" />}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-t border-slate-100">
                <td className="px-4 py-3 font-medium">{u.name}</td>
                <td className="px-4 py-3">{u.phone}</td>
                <td className="px-4 py-3">
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-medium text-slate-600">
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                      u.status === 'ACTIVE'
                        ? 'bg-emerald-100 text-emerald-700'
                        : 'bg-rose-100 text-rose-700'
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
                {isAdmin && (
                  <td className="px-4 py-3">
                    <button
                      onClick={() => toggleStatus(u)}
                      className="text-xs text-blue-600 hover:underline"
                    >
                      {u.status === 'ACTIVE' ? 'Suspend' : 'Activate'}
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
