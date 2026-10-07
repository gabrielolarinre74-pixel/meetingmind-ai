export default function Footer() {
  return (
    <footer className="no-print mt-20 border-t border-ink-200 bg-white">
      <div className="shell flex flex-col justify-between gap-2 py-6 text-[12.5px] text-ink-500 sm:flex-row">
        <span>
          <b className="font-extrabold text-ink-900">MeetingMind</b> · designed and built by{' '}
          <a className="font-semibold text-ink-900 underline decoration-brand-400 underline-offset-4 hover:text-brand-700" href="https://gabrielzion-portfolio.vercel.app" target="_blank" rel="noopener noreferrer">
            Gabriel Zion
          </a>
        </span>
        <span>Meetings are stored in this browser. No account, no tracking.</span>
      </div>
    </footer>
  );
}
