'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { clearSession, getSessionUser, getToken, SessionUser } from '@/lib/api';

const NAV = [
  { href: '/portal', label: 'Dashboard' },
  { href: '/portal/customers', label: 'Customers' },
  { href: '/portal/tickets', label: 'Tickets' },
  { href: '/portal/products', label: 'Products' },
  { href: '/portal/plans', label: 'Plans' },
  { href: '/portal/staff', label: 'Staff' },
];

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
    <div className="flex min-h-screen">
      <aside className="flex w-56 flex-col border-r border-slate-200 bg-white">
        <div className="border-b border-slate-200 px-5 py-4">
          <p className="font-bold">Anthar Works</p>
          <p className="text-xs text-slate-500">Staff Portal</p>
        </div>
        <nav className="flex-1 space-y-1 p-3">
          {NAV.map((item) => {
            const active =
              item.href === '/portal'
                ? pathname === '/portal'
                : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`block rounded-lg px-3 py-2 text-sm font-medium ${
                  active
                    ? 'bg-blue-50 text-blue-700'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 p-4">
          <p className="truncate text-sm font-medium">{user?.name}</p>
          <p className="text-xs text-slate-500">{user?.role}</p>
          <button
            onClick={() => {
              clearSession();
              router.replace('/portal/login');
            }}
            className="mt-2 text-sm text-rose-600 hover:underline"
          >
            Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 bg-slate-50 p-8">{children}</main>
    </div>
  );
}
