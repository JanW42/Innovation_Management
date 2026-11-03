'use client';

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'next/navigation';

interface Task { id: string; section: string; title: string; description: string | null; source: string | null; status: string; }

export default function TasksPage() {
  const { caseId } = useParams<{ caseId: string }>();
  const [tasks, setTasks] = useState<Task[]>([]);

  const load = useCallback(async () => {
    if (!caseId) return;
    const data = await fetch(`/api/cases/${caseId}/tasks`, { cache: 'no-store' }).then((r) => r.json());
    setTasks(data.tasks ?? []);
  }, [caseId]);

  useEffect(() => { void load(); }, [load]);

  async function toggle(id: string, status: string) {
    await fetch(`/api/cases/${caseId}/tasks/${id}`, {
      method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ status })
    });
    void load();
  }

  const sections = [...new Set(tasks.map((t) => t.section))];
  const done = tasks.filter((t) => t.status === 'done').length;

  return (
    <div className="space-y-6">
      <header className="border-b border-neutral-200 pb-4">
        <h1 className="text-xl font-semibold">Nächste Schritte im Sterbefall</h1>
        <p className="text-sm text-neutral-500">{done} von {tasks.length} erledigt. Entscheidungshilfe – keine Rechtsberatung.</p>
      </header>
      {sections.map((section) => (
        <section key={section} className="card">
          <h2 className="mb-3 font-semibold">{section}</h2>
          <ul className="space-y-3">
            {tasks.filter((t) => t.section === section).map((t) => (
              <li key={t.id} className="flex items-start gap-3">
                <input type="checkbox" className="mt-1" checked={t.status === 'done'} onChange={() => toggle(t.id, t.status === 'done' ? 'open' : 'done')} />
                <div>
                  <p className={`text-sm ${t.status === 'done' ? 'text-neutral-400 line-through' : ''}`}>{t.title}</p>
                  {t.description && <p className="text-xs text-neutral-500">{t.description}</p>}
                  {t.source && <p className="text-xs text-neutral-400">Quelle: {t.source}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
