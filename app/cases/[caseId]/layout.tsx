'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { CrossIcon, VineIcon } from '@/components/icons';

const LINKS: Array<[string, string]> = [
  ['overview', 'Übersicht'],
  ['accounts', 'Konten & Dokumente'],
  ['contracts', 'Verträge'],
  ['cancellation', 'Kündigungen'],
  ['tasks', 'Nächste Schritte'],
  ['family', 'Familie'],
  ['funeral', 'Bestatter'],
  ['chat', 'Hilfe']
];

export default function CaseLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const parts = pathname.split('/').filter(Boolean);
  const caseId = parts[1] ?? '';
  const section = parts[3] ?? (parts.length === 3 ? 'overview' : '');

  return (
    <div className="min-h-screen md:flex">
      <aside className="flex flex-col border-b border-neutral-200 bg-white p-4 md:min-h-screen md:w-64 md:border-b-0 md:border-r md:p-6">
        <Link href="/cases" className="mb-6 flex items-center gap-2 px-2 text-sm text-neutral-500 hover:text-black">
          <CrossIcon className="h-8 w-8" /> Fälle
        </Link>
        <nav className="flex flex-wrap gap-1 md:flex-col">
          {LINKS.map(([href, label]) => {
            const target = href === 'overview' ? `/cases/${caseId}` : `/cases/${caseId}/${href}`;
            const isActive = href === 'overview'
              ? pathname === `/cases/${caseId}` || pathname === `/cases/${caseId}/`
              : pathname.startsWith(target);
            return (
              <Link key={href} href={target}
                className={`block px-3 py-2 text-sm transition-colors duration-150 ${isActive ? 'bg-black text-white' : 'hover:bg-neutral-100'}`}>
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto hidden px-2 pt-8 text-neutral-400 md:block">
          <VineIcon className="h-8 w-40" />
          <p className="mt-2 text-[11px] leading-relaxed">Entscheidungshilfe – keine Rechtsberatung.</p>
        </div>
      </aside>
      <main className="flex-1 p-6 md:p-10">{children}</main>
    </div>
  );
}
