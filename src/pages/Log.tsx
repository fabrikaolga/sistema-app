import { useEffect, useState } from 'react';
import { supabase, errText } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Err } from '../components/ui';

const T: Record<string, string> = { deals: 'Сделка', tasks: 'Задача', plans: 'План', facts: 'Факт', profiles: 'Сотрудник', audits: 'Аудит', praises: 'Похвала', companies: 'Компания', pipeline_stages: 'Этап', metrics: 'Метрика', audit_templates: 'Чек-лист' };
const A: Record<string, string> = { INSERT: 'создал', UPDATE: 'изменил', DELETE: 'удалил' };

function label(r: any) {
  const d = r.new_data || r.old_data || {};
  return d.client_name || d.title || d.full_name || d.name || d.metric_key || '';
}
function diff(r: any) {
  if (r.action !== 'UPDATE') return '';
  const skip = ['updated_at', 'stage_changed_at'];
  return Object.keys(r.new_data || {}).filter((k) => !skip.includes(k) && JSON.stringify(r.new_data[k]) !== JSON.stringify(r.old_data?.[k]))
    .map((k) => `${k}: ${r.old_data?.[k] ?? '—'} → ${r.new_data[k] ?? '—'}`).join('; ');
}

export default function Log() {
  const { people } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [err, setErr] = useState('');
  useEffect(() => { supabase.from('audit_log').select('*').order('at', { ascending: false }).limit(300).then(({ data, error }) => error ? setErr(errText(error)) : setRows(data || [])); }, []);
  const name = (id: string) => people.find((p) => p.id === id)?.full_name || (id ? 'система' : 'система');
  return (
    <>
      <h1>Журнал действий</h1>
      <p className="sub">Кто, что и когда изменил. Записи нельзя изменить или удалить.</p>
      <Err text={err} />
      <div className="card"><div className="tbl-wrap"><table>
        <thead><tr><th>Когда</th><th>Кто</th><th>Действие</th><th>Объект</th><th>Изменения</th></tr></thead>
        <tbody>{rows.map((r) => <tr key={r.id}><td className="small">{new Date(r.at).toLocaleString('ru-RU')}</td><td>{name(r.actor_id)}</td><td>{A[r.action]}</td>
          <td>{T[r.table_name] || r.table_name}: {label(r)}</td><td className="muted small" style={{ maxWidth: 380 }}>{diff(r)}</td></tr>)}</tbody>
      </table></div></div>
    </>
  );
}
