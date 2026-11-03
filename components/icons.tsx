export function CrossIcon({ className = 'h-5 w-5' }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.25} strokeLinecap="round" className={className} aria-label="Kreuz">
      <path d="M12 3v18M6.5 8.5h11" />
    </svg>
  );
}

export function VineIcon({ className = 'h-5 w-24' }: { className?: string }) {
  return (
    <svg viewBox="0 0 96 24" fill="none" stroke="currentColor" strokeWidth={1} strokeLinecap="round" className={className} aria-label="Rebzweig">
      <path d="M4 18c14-10 26 6 40-4s26 2 48-6" />
      <path d="M22 14c-3-4-1-8 3-9 1 4-1 7-3 9z" />
      <path d="M44 10c-3-4-1-8 3-9 1 4-1 7-3 9z" />
      <path d="M66 9c-3-4-1-8 3-9 1 4-1 7-3 9z" />
      <path d="M22 14c3-2 6-2 9 0" />
      <path d="M44 10c3-2 6-2 9 0" />
      <path d="M66 9c3-2 6-2 9 0" />
    </svg>
  );
}
