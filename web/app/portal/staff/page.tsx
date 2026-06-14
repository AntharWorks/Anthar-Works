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
      <h1 className="page-title">Staff</h1>
      <p className="page-subtitle">
        Mobile number is the login ID; staff sign in with an SMS OTP.
      </p>

      {isAdmin && (
        <form
          onSubmit={createLogin}
          className="card mt-4 flex flex-wrap items-end gap-3 p-5"
        >
          <label className="label">
            Name
            <input
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              className="input mt-1"
              required
            />
          </label>
          <label className="label">
            Mobile (login ID)
            <input
              value={form.phone}
              maxLength={10}
              onChange={(e) => setForm({ ...form, phone: e.target.value.trim() })}
              className="input mt-1"
              required
            />
          </label>
          <label className="label">
            Role
            <select
              value={form.role}
              onChange={(e) => setForm({ ...form, role: e.target.value })}
              className="input mt-1"
            >
              {STAFF_ROLES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </label>
          <button className="btn btn-primary">
            Create login
          </button>
        </form>
      )}

      {error && <p className="mt-3 text-sm text-rose-600">{error}</p>}

      <div className="card mt-4 overflow-hidden">
        <table className="table-base">
          <thead>
            <tr>
              <th>Name</th>
              <th>Mobile</th>
              <th>Role</th>
              <th>Status</th>
              {isAdmin && <th />}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id}>
                <td className="font-medium">{u.name}</td>
                <td>{u.phone}</td>
                <td>
                  <span className="badge bg-slate-100 text-slate-600">
                    {u.role}
                  </span>
                </td>
                <td>
                  <span
                    className={`badge ${
                      u.status === 'ACTIVE'
                        ? 'bg-emerald-50 text-emerald-700'
                        : 'bg-rose-50 text-rose-700'
                    }`}
                  >
                    {u.status}
                  </span>
                </td>
                {isAdmin && (
                  <td>
                    <button
                      onClick={() => toggleStatus(u)}
                      className="text-xs text-brand-700 hover:text-brand-800"
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
