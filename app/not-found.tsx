import Link from 'next/link'

export default function NotFound() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden px-6 py-20 text-[var(--text-primary)]">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_85%_55%_at_50%_-15%,rgba(115,22,22,0.14),transparent_55%)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -left-20 top-[18%] h-64 w-44 -rotate-[14deg] rounded-xl border border-[var(--border-strong)] bg-[var(--surface)]/70 shadow-[var(--shadow-lg)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute -right-12 bottom-[22%] h-56 w-40 rotate-[11deg] rounded-xl border border-[var(--border-strong)] bg-[var(--surface-subtle)]/80 shadow-[var(--shadow-md)]"
      />
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-[42%] h-48 w-36 -translate-x-1/2 rotate-[3deg] rounded-lg border border-dashed border-[var(--accent)]/20 bg-[var(--accent-surface)]"
      />

      <div className="relative z-10 mx-auto max-w-[28rem] text-center">
        <p className="mb-3 text-[50px] font-bold uppercase tracking-[0.42em] text-[var(--accent)]">
          404
        </p>
        <h1 className="font-serif-display text-[2rem] font-semibold leading-[1.15] tracking-tight sm:text-[2.35rem]">
          Ой, мұндай бет жоқ екен.
        </h1>
        <p className="mt-5 text-[15px] leading-[1.65] text-[var(--text-secondary)]">
          Сілтеме қате. Басты бетке оралыңыз.
        </p>

        <Link
          href="/"
          className="mt-10 inline-flex min-h-[48px] items-center justify-center rounded-2xl bg-[var(--accent)] px-9 text-[15px] font-semibold text-white shadow-[0_4px_22px_rgba(115,22,22,0.38)] transition-[transform,box-shadow,background-color] duration-[var(--transition)] hover:-translate-y-0.5 hover:bg-[var(--accent-hover)] hover:shadow-[0_10px_32px_rgba(115,22,22,0.42)] active:scale-[0.98]"
        >
          Басты бетке оралу
        </Link>
      </div>

      <div
        aria-hidden
        className="pointer-events-none absolute bottom-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-[var(--accent)]/30 to-transparent"
      />
    </div>
  )
}
