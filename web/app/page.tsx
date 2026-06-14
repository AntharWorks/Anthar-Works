import Link from 'next/link';
import { DropletMark } from '@/components/Logo';
import { StoreLayout } from '@/components/store/StoreLayout';

const FEATURES = [
  {
    title: 'Flexible subscriptions',
    body: 'Monthly to yearly plans across brands, with one-click renewal and instant payment.',
    icon: (
      <path d="M4 7h16M4 12h16M4 17h10" strokeWidth="1.8" strokeLinecap="round" />
    ),
  },
  {
    title: 'Doorstep installation',
    body: 'Trained technicians install and demo your purifier, scheduled to a slot you pick.',
    icon: (
      <path
        d="M3 11.5 12 4l9 7.5M5 10v9h14v-9M10 19v-5h4v5"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    ),
  },
  {
    title: 'Warranty tracking',
    body: 'Every device and its warranty in one place, with timely reminders before expiry.',
    icon: (
      <path
        d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6l7-3Zm-2.5 8.5 2 2 4-4"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    ),
  },
  {
    title: 'Verified service',
    body: 'Geo-tagged before/after photos and SLA tracking on every service visit.',
    icon: (
      <path
        d="M12 21s7-4.5 7-11a7 7 0 1 0-14 0c0 6.5 7 11 7 11Zm0-8a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z"
        strokeWidth="1.8"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
    ),
  },
];

const STEPS = [
  { n: '1', title: 'Choose a purifier', body: 'Browse multi-brand models and pick a plan or one-time purchase.' },
  { n: '2', title: 'Pay & schedule', body: 'Secure checkout, then pick an installation slot that suits you.' },
  { n: '3', title: 'Relax — we service it', body: 'Doorstep install, warranty tracking and on-time service visits.' },
];

export default function StorefrontHome() {
  return (
    <StoreLayout>
      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="pointer-events-none absolute inset-0 -z-10">
          <div className="absolute -top-32 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 rounded-full bg-brand-200/40 blur-3xl" />
          <div className="absolute right-0 top-24 h-72 w-72 rounded-full bg-sky-200/40 blur-3xl" />
        </div>

        <div className="mx-auto max-w-6xl px-4 pb-12 pt-16 sm:px-6 sm:pt-24">
          <div className="mx-auto max-w-3xl text-center animate-fade-up">
            <span className="badge border border-brand-200 bg-brand-50 text-brand-700">
              <DropletMark className="h-3.5 w-3.5" />
              Clean water, doorstep service
            </span>
            <h1 className="mt-5 font-display text-4xl font-extrabold leading-[1.1] tracking-tight text-slate-900 sm:text-6xl">
              Pure water, <span className="text-brand-600">handled end-to-end</span>
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg text-slate-600">
              A multi-brand water-purifier marketplace — subscriptions, purchases,
              doorstep installation and warranty-backed service, all in one place.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
              <Link href="/products" className="btn btn-primary btn-lg">
                Browse purifiers
              </Link>
              <Link href="/renew" className="btn btn-outline btn-lg">
                Renew subscription
              </Link>
            </div>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-sm text-slate-500">
              <span className="inline-flex items-center gap-1.5">
                <Check /> All major brands
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check /> Instant secure payments
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Check /> 1-year warranty tracking
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((f) => (
            <div key={f.title} className="card card-hover p-6">
              <span className="inline-flex h-11 w-11 items-center justify-center rounded-xl bg-brand-50 text-brand-600">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" className="h-6 w-6">
                  {f.icon}
                </svg>
              </span>
              <h3 className="mt-4 text-base font-semibold text-slate-900">{f.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* How it works */}
      <section className="mx-auto max-w-6xl px-4 py-12 sm:px-6">
        <div className="text-center">
          <h2 className="font-display text-3xl font-bold tracking-tight text-slate-900">
            How it works
          </h2>
          <p className="mx-auto mt-2 max-w-xl text-slate-500">
            From browsing to clean water at home in three simple steps.
          </p>
        </div>
        <div className="mt-10 grid gap-6 md:grid-cols-3">
          {STEPS.map((s) => (
            <div key={s.n} className="relative card p-6">
              <span className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-gradient font-display text-base font-bold text-white shadow-soft">
                {s.n}
              </span>
              <h3 className="mt-4 text-lg font-semibold text-slate-900">{s.title}</h3>
              <p className="mt-1.5 text-sm text-slate-500">{s.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* CTA band */}
      <section className="mx-auto max-w-6xl px-4 sm:px-6">
        <div className="relative overflow-hidden rounded-3xl bg-brand-gradient px-6 py-12 text-center shadow-soft sm:px-12">
          <div className="pointer-events-none absolute -right-10 -top-10 h-48 w-48 rounded-full bg-white/10 blur-2xl" />
          <h2 className="font-display text-2xl font-bold text-white sm:text-3xl">
            Upgrading or replacing? Get more for your old purifier.
          </h2>
          <p className="mx-auto mt-3 max-w-xl text-brand-50/90">
            Refer a friend or trade in your existing unit with our buy-back program.
          </p>
          <div className="mt-7 flex flex-wrap justify-center gap-3">
            <Link href="/refer" className="btn btn-lg bg-white text-brand-700 hover:bg-brand-50">
              Refer &amp; Buy-back
            </Link>
            <Link
              href="/products"
              className="btn btn-lg border border-white/40 text-white hover:bg-white/10"
            >
              Browse purifiers
            </Link>
          </div>
        </div>
      </section>
    </StoreLayout>
  );
}

function Check() {
  return (
    <svg viewBox="0 0 20 20" className="h-4 w-4 text-brand-600" fill="currentColor">
      <path
        fillRule="evenodd"
        d="M16.7 5.3a1 1 0 0 1 0 1.4l-7.5 7.5a1 1 0 0 1-1.4 0L3.3 9.7a1 1 0 1 1 1.4-1.4l3.3 3.29 6.8-6.8a1 1 0 0 1 1.4 0Z"
        clipRule="evenodd"
      />
    </svg>
  );
}
