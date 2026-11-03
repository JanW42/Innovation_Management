'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/cases');
  }, [router]);
  return (
    <main className="flex min-h-screen items-center justify-center text-neutral-400">
      Lade …
    </main>
  );
}
