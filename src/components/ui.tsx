import type { ReactNode } from 'react';
import { useAuth } from '../lib/auth';
import type { Profile } from '../lib/supabase';

export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="modal-bg" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal" role="dialog" aria-label={title}>
        <div className="row between"><h2>{title}</h2><button className="small" onClick={onClose} aria-label="Закрыть">✕</button></div>
        {children}
      </div>
    </div>
  );
}

export function Err({ text }: { text: string }) { return text ? <div className="err">{text}</div> : null; }

const STATUS: Record<string, [string, string]> = {
  ok: ['ok', 'В норме'], risk: ['risk', 'Риск'], fail: ['fail', 'Провал'], no_plan: ['neutral', 'Нет плана'],
  new: ['info', 'Новая'], in_progress: ['info', 'В работе'], review: ['risk', 'На проверке'], accepted: ['ok', 'Принята'],
  returned: ['fail', 'На доработке'], overdue: ['fail', 'Просрочена'],
  open: ['info', 'В работе'], won: ['ok', 'Выиграна'], lost: ['neutral', 'Проиграна'],
};
export function Pill({ s }: { s: string }) {
  const [cls, label] = STATUS[s] || ['neutral', s];
  return <span className={`pill ${cls}`}>{label}</span>;
}

export function Progress({ pct, status }: { pct: number | null; status?: string }) {
  const color = status === 'fail' ? 'var(--fail)' : status === 'risk' ? 'var(--risk)' : 'var(--ok)';
  return <div className="bar"><i style={{ width: `${Math.min(pct || 0, 100)}%`, background: color }} /></div>;
}

export function PersonSelect({ value, onChange, people, placeholder = 'Выберите сотрудника', id }:
  { value: string; onChange: (v: string) => void; people: Profile[]; placeholder?: string; id?: string }) {
  const { roleTitle } = useAuth();
  return (
    <select id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      <option value="">{placeholder}</option>
      {people.map((p) => <option key={p.id} value={p.id}>{p.full_name} · {roleTitle(p.role_key)}</option>)}
    </select>
  );
}

export function Field({ label, children, htmlFor }: { label: string; children: ReactNode; htmlFor?: string }) {
  return <div className="field"><label htmlFor={htmlFor}>{label}</label>{children}</div>;
}
