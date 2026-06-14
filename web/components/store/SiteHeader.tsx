import Link from 'next/link';
import { Logo } from '../Logo';

const NAV = [
  { href: '/products', label: 'Purifiers' },
  { href: '/renew', label: 'Renew' },
  { href: '/refer', label: 'Refer & Buy-back' },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-40 border-b border-slate-200/70 bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/65">
      <div className="mx-auto flex h-16 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="shrink-0">
          <Logo />
        </Link>

        <nav className="hidden items-center gap-1 md:flex">
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="rounded-lg px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/account" className="btn btn-ghost btn-sm hidden sm:inline-flex">
            My account
          </Link>
          <Link href="/products" className="btn btn-primary btn-sm">
            Shop now
          </Link>
        </div>
      </div>
    </header>
  );
}
