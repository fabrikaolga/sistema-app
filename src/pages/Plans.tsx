import { useEffect, useState } from 'react';
import { supabase, errText, monthStart, num, today } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Modal, Err, Field, Pill, Progress, PersonSelect } from '../components/ui';

export default function Plans() {
  const { profile, roleTitle, isManager } = useAuth();
  const [month, setMonth] = useState(monthStart().slice(0, 7));
  const [rows, setRows] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [metric, setMetric] = useState('');
  const [fact, setFact] = useState(false);
  const [plan, setPlan] = useState(false);
  const [err, setErr] = useState('');

  async function load() {
    const [a, b] = await Promise.all([supabase.rpc('plan_fact', { p_month: month + '-01' }), supabase.from('metrics').select('*').order('is_main', { ascending: false })]);
    if (a.error || b.error) return setErr(errText(a.error || b.error));
    setRows(a.data || []); setMetrics(b.data || []);
    if (!metric && b.data?.length) setMetric(b.data[0].key);
  }
  useEffect(() => { load(); }, [month]);

  const shown = rows.filter((r) => r.metric_key === metric).sort((a, b) => (a.owner_id === profile!.id ? -1 : 0) - (b.owner_id === profile!.id ? -1 : 0) || a.full_name.localeCompare(b.full_name));

  return (
    <>
      <div className="row between"><div><h1>План / факт</h1><p className="sub">Отклонение считается от нормы на сегодняшний рабочий день</p></div>
        <div className="row">
          <button onClick={() => setFact(true)}>Внести факт</button>
          {isManager && <button className="primary" onClick={() => setPlan(true)}>Задать план месяца</button>}
        </div></div>
      <Err text={err} />
      <div className="row" style={{ marginBottom: 14 }}>
        <input type="month" style={{ width: 180 }} value={month} onChange={(e) => setMonth(e.target.value)} aria-label="Месяц" />
        <div className="tabs" style={{ margin: 0 }}>{metrics.map((m) => <button key={m.key} className={metric === m.key ? 'on' : ''} onClick={() => setMetric(m.key)}>{m.title}</button>)}</div>
      </div>
      <div className="card"><div className="tbl-wrap"><table>
        <thead><tr><th>Сотрудник</th><th>Роль</th><th>План</th><th>Факт</th><th>Отклонение</th><th>Выполнение</th><th>Статус</th></tr></thead>
        <tbody>{shown.map((r) => (
          <tr key={r.owner_id}>
            <td>{r.full_name}{r.owner_id === profile!.id && <span className="pill info" style={{ marginLeft: 6 }}>вы</span>}</td>
            <td className="muted">{roleTitle(r.role_key)}</td>
            <td>{num(r.plan)}</td><td>{num(r.fact)}</td>
            <td style={{ color: r.plan && r.fact - r.plan * r.expected_pct / 100 < 0 ? 'var(--fail)' : 'var(--ok)' }}>
              {r.plan ? num(r.fact - r.plan * r.expected_pct / 100) : '—'}</td>
            <td style={{ minWidth: 120 }}>{r.pct !== null ? `${num(r.pct)}%` : '—'}<Progress pct={r.pct} status={r.status} /></td>
            <td><Pill s={r.status} /></td>
          </tr>))}
        </tbody></table></div>
        <p className="muted small">Отклонение = факт − план × доля прошедших рабочих дней. Факт руководителя = сумма его команды.</p>
      </div>
      {fact && <FactForm metrics={metrics} onClose={(c) => { setFact(false); if (c) load(); }} />}
      {plan && <PlanForm metrics={metrics} month={month} onClose={(c) => { setPlan(false); if (c) load(); }} />}
    </>
  );
}

function FactForm({ metrics, onClose }: { metrics: any[]; onClose: (c: boolean) => void }) {
  const { profile, people, isManager } = useAuth();
  const [f, setF] = useState({ owner_id: profile!.id, metric_key: metrics.find((m) => !['deals_won', 'revenue'].includes(m.key))?.key || metrics[0]?.key, fact_date: today(), value: '' });
  const [err, setErr] = useState('');
  async function save() {
    if (!f.value || Number(f.value) <= 0) return setErr('Введите значение больше нуля');
    const { error } = await supabase.from('facts').insert({ ...f, value: Number(f.value) });
    if (error) return setErr(errText(error));
    onClose(true);
  }
  return (
    <Modal title="Внести факт" onClose={() => onClose(false)}>
      <Err text={err} />
      <p className="muted small">Выигранные сделки и выручка попадают в факт автоматически из раздела «Сделки».</p>
      {isManager && <Field label="Сотрудник"><PersonSelect value={f.owner_id} onChange={(v) => setF({ ...f, owner_id: v })} people={people.filter((p) => p.is_active)} /></Field>}
      <div className="grid g3">
        <Field label="Показатель" htmlFor="mk"><select id="mk" value={f.metric_key} onChange={(e) => setF({ ...f, metric_key: e.target.value })}>{metrics.map((m) => <option key={m.key} value={m.key}>{m.title}</option>)}</select></Field>
        <Field label="Дата" htmlFor="fd"><input id="fd" type="date" value={f.fact_date} max={today()} onChange={(e) => setF({ ...f, fact_date: e.target.value })} /></Field>
        <Field label="Значение" htmlFor="fv"><input id="fv" type="number" min="0" value={f.value} onChange={(e) => setF({ ...f, value: e.target.value })} /></Field>
      </div>
      <button className="primary" onClick={save}>Сохранить</button>
    </Modal>
  );
}

function PlanForm({ metrics, month, onClose }: { metrics: any[]; month: string; onClose: (c: boolean) => void }) {
  const { profile, people } = useAuth();
  const [f, setF] = useState({ owner: profile!.id, metric: metrics.find((m) => m.is_main)?.key || metrics[0]?.key, total: '' });
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');
  const owners = people.filter((p) => p.is_active && ['director', 'assistant_director', 'head_manager', 'team_lead', 'seller'].includes(p.role_key));
  async function save() {
    setErr(''); setOk('');
    if (!f.total || Number(f.total) <= 0) return setErr('Введите план больше нуля');
    const { data, error } = await supabase.rpc('decompose_plan', { p_owner: f.owner, p_metric: f.metric, p_month: month + '-01', p_total: Number(f.total) });
    if (error) return setErr(errText(error));
    setOk(`План разложен на ${data} чел. по рабочим дням месяца.`);
    setTimeout(() => onClose(true), 900);
  }
  return (
    <Modal title={`План на ${month}`} onClose={() => onClose(false)}>
      <Err text={err} />{ok && <div className="okmsg">{ok}</div>}
      <p className="muted small">Сумма делится поровну между менеджерами в подразделении выбранного руководителя, затем по рабочим дням. Планы руководителей = сумма их команд.</p>
      <Field label="Подразделение (руководитель или сотрудник)"><PersonSelect value={f.owner} onChange={(v) => setF({ ...f, owner: v })} people={owners} /></Field>
      <div className="grid g2">
        <Field label="Показатель" htmlFor="pm"><select id="pm" value={f.metric} onChange={(e) => setF({ ...f, metric: e.target.value })}>{metrics.map((m) => <option key={m.key} value={m.key}>{m.title}</option>)}</select></Field>
        <Field label="План на месяц" htmlFor="pt"><input id="pt" type="number" min="0" value={f.total} onChange={(e) => setF({ ...f, total: e.target.value })} /></Field>
      </div>
      <button className="primary" onClick={save}>Разложить план</button>
    </Modal>
  );
}
