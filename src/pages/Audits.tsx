import { useEffect, useState } from 'react';
import { supabase, errText, fmtDate } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Modal, Err, Field, PersonSelect } from '../components/ui';

export default function Audits() {
  const { profile, people, roleTitle, isManager } = useAuth();
  const [audits, setAudits] = useState<any[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [run, setRun] = useState(false);
  const [view, setView] = useState<any>(null);
  const [err, setErr] = useState('');
  const name = (id: string) => people.find((p) => p.id === id)?.full_name || '—';

  async function load() {
    const [a, t] = await Promise.all([supabase.from('audits').select('*').order('created_at', { ascending: false }), supabase.from('audit_templates').select('*')]);
    if (a.error || t.error) return setErr(errText(a.error || t.error));
    setAudits(a.data || []); setTemplates(t.data || []);
  }
  useEffect(() => { load(); }, []);

  return (
    <>
      <div className="row between"><div><h1>Аудиты моделей работ</h1><p className="sub">Проверка по чек-листу роли. Каждое нарушение сразу становится задачей со сроком 7 дней.</p></div>
        {isManager && <button className="primary" onClick={() => setRun(true)}>Провести аудит</button>}</div>
      <Err text={err} />
      <div className="card"><div className="tbl-wrap"><table>
        <thead><tr><th>Дата</th><th>Сотрудник</th><th>Аудитор</th><th>Балл</th><th>Нарушений</th></tr></thead>
        <tbody>{audits.length === 0 && <tr><td colSpan={5} className="empty">Аудитов ещё не было</td></tr>}
          {audits.map((a) => {
            const bad = a.results.filter((x: any) => !x.ok).length;
            return <tr key={a.id} style={{ cursor: 'pointer' }} onClick={() => setView(a)}>
              <td>{fmtDate(a.created_at.slice(0, 10))}</td><td>{name(a.subject_id)}{a.subject_id === profile!.id && <span className="pill info" style={{ marginLeft: 6 }}>вы</span>}</td><td className="muted">{name(a.auditor_id)}</td>
              <td><span className={`pill ${a.score >= 90 ? 'ok' : a.score >= 70 ? 'risk' : 'fail'}`}>{a.score}%</span></td><td>{bad}</td></tr>;
          })}</tbody></table></div></div>
      <div className="card"><h2>Чек-листы по ролям</h2>
        {templates.map((t) => <details key={t.id} style={{ marginBottom: 8 }}><summary><b>{roleTitle(t.role_key)}</b> — {t.title} ({t.items.length} пунктов)</summary>
          <ol className="small">{t.items.map((i: any, k: number) => <li key={k}>{i.text} <span className="muted">· вес {i.weight}</span></li>)}</ol></details>)}
      </div>
      {run && <RunAudit templates={templates} onClose={(c) => { setRun(false); if (c) load(); }} />}
      {view && <Modal title={`Аудит: ${name(view.subject_id)} · ${view.score}%`} onClose={() => setView(null)}>
        {view.results.map((r: any, i: number) => <div className="chk" key={i}><span className={`pill ${r.ok ? 'ok' : 'fail'}`}>{r.ok ? 'Да' : 'Нет'}</span><div>{r.text}{r.comment && <div className="muted small">{r.comment}</div>}</div></div>)}
      </Modal>}
    </>
  );
}

function RunAudit({ templates, onClose }: { templates: any[]; onClose: (c: boolean) => void }) {
  const { profile, people, roleTitle } = useAuth();
  const [subject, setSubject] = useState('');
  const [subs, setSubs] = useState<string[]>([]);
  const [res, setRes] = useState<any[]>([]);
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  useEffect(() => { supabase.rpc('subordinates', { p_uid: profile!.id }).then(({ data }) => setSubs((data || []).map((x: any) => x.subordinates ?? x))); }, []);
  const top = ['director', 'assistant_director'].includes(profile!.role_key);
  const candidates = people.filter((p) => p.is_active && p.id !== profile!.id && (top || subs.includes(p.id)));
  const person = people.find((p) => p.id === subject);
  const tpl = templates.find((t) => t.role_key === person?.role_key);
  useEffect(() => { setRes(tpl ? tpl.items.map((i: any) => ({ ...i, ok: true, comment: '' })) : []); }, [subject]);

  async function save() {
    setErr(''); setBusy(true);
    const { error } = await supabase.rpc('complete_audit', { p_template: tpl.id, p_subject: subject, p_results: res });
    setBusy(false);
    if (error) return setErr(errText(error));
    onClose(true);
  }
  return (
    <Modal title="Аудит по модели работ" onClose={() => onClose(false)}>
      <Err text={err} />
      <Field label="Сотрудник"><PersonSelect value={subject} onChange={setSubject} people={candidates} /></Field>
      {person && !tpl && <p className="muted">Для роли «{roleTitle(person.role_key)}» нет чек-листа. Добавьте его в настройках.</p>}
      {res.map((r, i) => (
        <div className="chk" key={i}>
          <input type="checkbox" checked={r.ok} onChange={(e) => setRes(res.map((x, k) => k === i ? { ...x, ok: e.target.checked } : x))} aria-label={r.text} />
          <div style={{ flex: 1 }}>{r.text} <span className="muted small">· вес {r.weight}</span>
            {!r.ok && <input style={{ marginTop: 6 }} placeholder="Что не так (попадёт в задачу)" value={r.comment} onChange={(e) => setRes(res.map((x, k) => k === i ? { ...x, comment: e.target.value } : x))} />}
          </div>
        </div>
      ))}
      {tpl && <button className="primary" style={{ marginTop: 14 }} disabled={busy} onClick={save}>Завершить аудит</button>}
    </Modal>
  );
}
