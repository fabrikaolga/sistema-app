import { useEffect, useState } from 'react';
import { supabase, errText, fmtDate, addDays, today } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Modal, Err, Field, Pill, PersonSelect } from '../components/ui';

const SRC: Record<string, string> = { manual: '', meeting: 'встреча', audit: 'аудит', ai: 'AI' };

export default function Tasks() {
  const { profile, people, isManager } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [tab, setTab] = useState<'mine' | 'set' | 'team'>('mine');
  const [create, setCreate] = useState(false);
  const [ret, setRet] = useState<any>(null);
  const [err, setErr] = useState('');
  const name = (id: string) => people.find((p) => p.id === id)?.full_name || '—';

  async function load() {
    const { data, error } = await supabase.from('tasks').select('*').order('due_date');
    if (error) setErr(errText(error)); else setRows(data || []);
  }
  useEffect(() => { load(); }, []);

  async function setStatus(t: any, status: string, review_comment?: string) {
    setErr('');
    const { error } = await supabase.from('tasks').update({ status, ...(review_comment !== undefined ? { review_comment } : {}) }).eq('id', t.id);
    if (error) setErr(errText(error)); else load();
  }

  const me = profile!.id;
  const shown = rows.filter((t) => tab === 'mine' ? t.assignee_id === me : tab === 'set' ? t.creator_id === me && t.assignee_id !== me : t.assignee_id !== me && t.creator_id !== me);
  const open = shown.filter((t) => t.status !== 'accepted');
  const closed = shown.filter((t) => t.status === 'accepted');

  return (
    <>
      <div className="row between"><div><h1>Задачи</h1><p className="sub">Постановка по SMART: результат в цифре, срок, исполнитель. Закрывает только постановщик.</p></div>
        <button className="primary" onClick={() => setCreate(true)}>Поставить задачу</button></div>
      <Err text={err} />
      <div className="tabs">
        <button className={tab === 'mine' ? 'on' : ''} onClick={() => setTab('mine')}>Мне</button>
        <button className={tab === 'set' ? 'on' : ''} onClick={() => setTab('set')}>Я поставил</button>
        {isManager && <button className={tab === 'team' ? 'on' : ''} onClick={() => setTab('team')}>Команда</button>}
      </div>
      <div className="card"><div className="tbl-wrap"><table>
        <thead><tr><th>Задача</th><th>Ожидаемый результат</th><th>Срок</th><th>{tab === 'mine' ? 'Постановщик' : 'Исполнитель'}</th><th>Статус</th><th></th></tr></thead>
        <tbody>
          {open.length === 0 && <tr><td colSpan={6} className="empty">Открытых задач нет</td></tr>}
          {open.map((t) => (
            <tr key={t.id}>
              <td><b>{t.title}</b>{SRC[t.source] && <span className="pill neutral" style={{ marginLeft: 6 }}>{SRC[t.source]}</span>}
                {t.review_comment && t.status === 'returned' && <div className="small" style={{ color: 'var(--fail)' }}>Комментарий: {t.review_comment}</div>}</td>
              <td className="muted">{t.expected_result}</td>
              <td>{fmtDate(t.due_date)}</td>
              <td>{name(tab === 'mine' ? t.creator_id : t.assignee_id)}</td>
              <td><Pill s={t.status} /></td>
              <td><div className="row">
                {t.assignee_id === me && ['new', 'returned', 'overdue'].includes(t.status) && <button className="small" onClick={() => setStatus(t, 'in_progress')}>В работу</button>}
                {t.assignee_id === me && ['new', 'in_progress', 'returned', 'overdue'].includes(t.status) && <button className="small" onClick={() => setStatus(t, 'review')}>Сдать</button>}
                {t.creator_id === me && t.status === 'review' && <>
                  <button className="small primary" onClick={() => setStatus(t, 'accepted')}>Принять</button>
                  <button className="small" onClick={() => setRet(t)}>Вернуть</button></>}
                {t.creator_id === me && t.assignee_id === me && t.status !== 'review' && <button className="small" onClick={() => setStatus(t, 'accepted')}>Закрыть</button>}
              </div></td>
            </tr>
          ))}
        </tbody>
      </table></div></div>
      {closed.length > 0 && <div className="card"><h2>Принятые ({closed.length})</h2><table><tbody>
        {closed.slice(0, 30).map((t) => <tr key={t.id}><td>{t.title}</td><td className="muted">{name(t.assignee_id)}</td><td>{fmtDate(t.due_date)}</td></tr>)}
      </tbody></table></div>}
      {create && <CreateTask onClose={(c) => { setCreate(false); if (c) load(); }} />}
      {ret && <ReturnTask onClose={(c, text) => { const t = ret; setRet(null); if (c) setStatus(t, 'returned', text); }} />}
    </>
  );
}

export function CreateTask({ onClose, preset }: { onClose: (changed: boolean) => void; preset?: any }) {
  const { profile, people, isManager } = useAuth();
  const [f, setF] = useState({ title: preset?.title || '', expected_result: preset?.expected_result || '', due_date: addDays(3), assignee_id: preset?.assignee_id || profile!.id, deal_id: preset?.deal_id || null });
  const [err, setErr] = useState('');
  const [candidates, setCandidates] = useState(people.filter((p) => p.id === profile!.id));
  useEffect(() => {
    if (!isManager) return;
    supabase.rpc('subordinates', { p_uid: profile!.id }).then(({ data }) => {
      const ids = new Set<string>((data || []).map((x: any) => x.subordinates ?? x));
      const top = ['director', 'assistant_director'].includes(profile!.role_key);
      setCandidates(people.filter((p) => p.is_active && (p.id === profile!.id || ids.has(p.id) || (top && p.company_id === profile!.company_id))));
    });
  }, []);
  async function save() {
    setErr('');
    if (f.title.trim().length < 5) return setErr('Опишите задачу конкретно');
    if (f.expected_result.trim().length < 5) return setErr('Укажите измеримый результат: что и сколько');
    if (f.due_date < today()) return setErr('Срок не может быть в прошлом');
    const { error } = await supabase.from('tasks').insert({ ...f, title: f.title.trim(), expected_result: f.expected_result.trim(), creator_id: profile!.id, source: preset?.source || 'manual' });
    if (error) return setErr(errText(error));
    onClose(true);
  }
  return (
    <Modal title="Новая задача" onClose={() => onClose(false)}>
      <Err text={err} />
      <Field label="Что сделать" htmlFor="tt"><input id="tt" value={f.title} onChange={(e) => setF({ ...f, title: e.target.value })} placeholder="Например: обзвонить базу отказников за октябрь" /></Field>
      <Field label="Измеримый результат" htmlFor="tr"><textarea id="tr" value={f.expected_result} onChange={(e) => setF({ ...f, expected_result: e.target.value })} placeholder="Например: 40 звонков, 5 встреч назначено" /></Field>
      <div className="grid g2">
        <Field label="Срок" htmlFor="td"><input id="td" type="date" value={f.due_date} onChange={(e) => setF({ ...f, due_date: e.target.value })} /></Field>
        <Field label="Исполнитель"><PersonSelect value={f.assignee_id} onChange={(v) => setF({ ...f, assignee_id: v })} people={candidates} /></Field>
      </div>
      <button className="primary" onClick={save}>Поставить</button>
    </Modal>
  );
}

function ReturnTask({ onClose }: { onClose: (c: boolean, text?: string) => void }) {
  const [t, setT] = useState('');
  return (
    <Modal title="Вернуть на доработку" onClose={() => onClose(false)}>
      <Field label="Что исправить"><textarea value={t} onChange={(e) => setT(e.target.value)} /></Field>
      <button className="primary" disabled={!t.trim()} onClick={() => onClose(true, t.trim())}>Вернуть</button>
    </Modal>
  );
}
