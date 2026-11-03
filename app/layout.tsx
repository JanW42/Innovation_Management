import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Stillstand – Nachlass und Verträge',
  description: 'Ruhige Begleitung bei der Nachlassverwaltung: Konten, Verträge und Kündigungen.'
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="de">
      <body>{children}</body>
    </html>
  );
}
