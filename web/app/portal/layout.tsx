'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { Logo } from '@/components/Logo';
import { clearSession, getSessionUser, getToken, SessionUser } from '@/lib/api';

const NAV = [
  { href: '/portal', label: 'Dashboard' },
  { href: '/portal/customers', label: 'Customers' },
  { href: '/portal/tickets', label: 'Tickets' },
  { href: '/portal/orders', label: 'Orders' },
  { href: '/portal/leads', label: 'Leads' },
  { href: '/portal/products', label: 'Products' },
  { href: '/portal/plans', label: 'Plans' },
  { href: '/portal/staff', label: 'Staff' },
  { href: '/portal/allocations', label: 'Allocations' },
  { href: '/portal/reports', label: 'Reports' },
  { href: '/portal/notifications', label: 'Notifications' },
  { href: '/portal/settings', label: 'Settings', adminOnly: true },
];

function initials(name?: string) {
  if (!name) return '?';
  return name
    .split(' ')
    .map((p) => p[0])
    .slice(0, 2)
    .join('')
    .toUpperCase();
}

export default function PortalLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const isLogin = pathname === '/portal/login';
  const [user, setUser] = useState<SessionUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (isLogin) {
      setReady(true);
      return;
    }
    if (!getToken()) {
      router.replace('/portal/login');
      return;
    }
    setUser(getSessionUser());
    setReady(true);
  }, [isLogin, pathname, router]);

  if (isLogin) return <>{children}</>;
  if (!ready) return null;

  return (
    <div className="flex min-h-screen bg-slate-50">
      <aside className="flex w-60 flex-col border-r border-slate-200 bg-white">
        <div className="flex h-16 items-center border-b border-slate-200 px-5">
          <Logo />
        </div>
        <nav className="flex-1 space-y-0.5 overflow-y-auto p-3">
          {NAV.filter((item) => !item.adminOnly || user?.role === 'ADMIN').map((item) => {
            const active =
              item.href === '/portal'
                ? pathname === '/portal'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`relative flex items-center rounded-lg px-3 py-2 text-sm font-medium transition ${
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {active && (
                  <span className="absolute left-0 top-1/2 h-5 w-1 -translate-y-1/2 rounded-r-full bg-brand-600" />
                )}
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-3">
          <div className="flex items-center gap-3 rounded-xl px-2 py-2">
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-brand-gradient text-xs font-bold text-white">
              {initials(user?.name)}
            </span>
            <div className="min-w-0">
              <p className="truncate text-sm font-semibold text-slate-900">{user?.name}</p>
              <p className="text-xs text-slate-500">{user?.role}</p>
            </div>
          </div>
          <button
            onClick={() => {
              clearSession();
              router.replace('/portal/login');
            }}
            className="mt-1 w-full rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-600 transition hover:bg-rose-50"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-x-hidden p-6 sm:p-8">
        <div className="mx-auto max-w-6xl">{children}</div>
      </main>
    </div>
  );
}
