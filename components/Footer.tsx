export default function Footer() {
  return (
    <footer className="mt-16 border-t border-ink-300/20 py-8 text-sm text-ink-500">
      <div className="max-width flex flex-col justify-between gap-2 sm:flex-row">
        <span>
          MeetingMind · built by{' '}
          <a className="font-medium text-brand-600 hover:underline" href="https://gabrielzion-portfolio.vercel.app" target="_blank" rel="noopener noreferrer">
            Gabriel Zion (Gabriel.ATH)
          </a>
        </span>
        <span>Your meetings stay in your browser. No account, no tracking.</span>
      </div>
    </footer>
  );
}
