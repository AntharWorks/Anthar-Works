import Link from 'next/link';
import { Logo } from '../Logo';

export function SiteFooter() {
  return (
    <footer className="mt-20 border-t border-slate-200 bg-white">
      <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6">
        <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
          <div className="max-w-xs">
            <Logo />
            <p className="mt-3 text-sm text-slate-500">
              Multi-brand water purifier subscriptions, purchases, doorstep
              installation and warranty-backed service.
            </p>
          </div>
          <div className="grid grid-cols-2 gap-8 text-sm">
            <div>
              <p className="font-semibold text-slate-900">Shop</p>
              <ul className="mt-3 space-y-2 text-slate-500">
                <li><Link href="/products" className="hover:text-brand-700">Purifiers</Link></li>
                <li><Link href="/renew" className="hover:text-brand-700">Renew plan</Link></li>
                <li><Link href="/refer" className="hover:text-brand-700">Refer &amp; Buy-back</Link></li>
              </ul>
            </div>
            <div>
              <p className="font-semibold text-slate-900">Account</p>
              <ul className="mt-3 space-y-2 text-slate-500">
                <li><Link href="/account" className="hover:text-brand-700">My account</Link></li>
                <li><Link href="/portal" className="hover:text-brand-700">Staff portal</Link></li>
              </ul>
            </div>
          </div>
        </div>
        <div className="mt-8 border-t border-slate-100 pt-6 text-xs text-slate-400">
          © {new Date().getFullYear()} Anthar Works. Clean water, doorstep service.
        </div>
      </div>
    </footer>
  );
}
