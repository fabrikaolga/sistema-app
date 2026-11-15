import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase, monthStart, num, fmtDate, errText } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Pill, Progress, Err, Modal, Field, PersonSelect } from '../components/ui';

export default function Dashboard() {
  const { profile, people, roleTitle, isManager } = useAuth();
  const [pf, setPf] = useState<any[]>([]);
  const [recos, setRecos] = useState<any[]>([]);
  const [lb, setLb] = useState<any[]>([]);
  const [tasks, setTasks] = useState<any[]>([]);
  const [praises, setPraises] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [err, setErr] = useState('');
  const [praiseOpen, setPraiseOpen] = useState(false);

  async function load() {
    try {
      const m = monthStart();
      const [a, b, c, d, e, f] = await Promise.all([
        supabase.rpc('plan_fact', { p_month: m }),
        supabase.rpc('recommendations'),
        supabase.rpc('leaderboard', { p_month: m }),
        supabase.from('tasks').select('*').eq('assignee_id', profile!.id).not('status', 'eq', 'accepted').order('due_date').limit(8),
        supabase.from('praises').select('*').order('created_at', { ascending: false }).limit(5),
        supabase.from('deals').select('id,amount,status,owner_id').eq('status', 'open'),
      ]);
      for (const r of [a, b, c, d, e, f]) if (r.error) throw r.error;
      setPf(a.data || []); setRecos(b.data || []); setLb(c.data || []); setTasks(d.data || []); setPraises(e.data || []); setDeals(f.data || []);
    } catch (x) { setErr(errText(x)); }
  }
  useEffect(() => { load(); }, []);

  const mine = pf.filter((r) => r.owner_id === profile!.id);
  const team = pf.filter((r) => r.owner_id !== profile!.id && r.is_main);
  const myRecos = isManager ? recos : recos.filter((r) => r.owner_id === profile!.id);
  const name = (id: string) => people.find((p) => p.id === id)?.full_name || '';
  const pipeline = deals.reduce((s, d) => s + Number(d.amount || 0), 0);

  return (
    <>
      <h1>Здравствуйте, {profile!.full_name.split(' ')[0]}</h1>
      <p className="sub">{roleTitle(profile!.role_key)} · {new Date().toLocaleDateString('ru-RU', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
      <Err text={err} />

      <div className="grid g4">
        {mine.map((r) => (
          <div className="card stat" key={r.metric_key}>
            <div className="k">{r.metric_title}{r.is_main ? ' · главный' : ''}</div>
            <div className="v">{num(r.fact)} <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>/ {num(r.plan)} {r.unit}</span></div>
            <Progress pct={r.pct} status={r.status} />
            <div className="d">{r.pct !== null ? `${num(r.pct)}% при норме ${num(r.expected_pct)}% на сегодня` : 'План не задан'} {r.status !== 'no_plan' && <Pill s={r.status} />}</div>
          </div>
        ))}
        <div className="card stat"><div className="k">Открытые сделки</div><div className="v">{deals.length}</div><div className="d">в работе на сумму {num(pipeline)}</div></div>
      </div>

      <div className="grid g2">
        <div className="card">
          <div className="row between"><h2>Что сделать сегодня</h2><span className="muted small">AI-наставник</span></div>
          {myRecos.length === 0 && <div className="empty">Отклонений нет. Работайте по плану.</div>}
          {myRecos.slice(0, 8).map((r, i) => (
            <div key={i} className={`reco s${r.severity}`}>
              <b>{r.title}{isManager && r.owner_id !== profile!.id ? ` — ${r.owner_name}` : ''}</b>
              <p>{r.detail}</p>
            </div>
          ))}
        </div>
        <div className="card">
          <div className="row between"><h2>Мои задачи</h2><Link to="/tasks">Все задачи</Link></div>
          {tasks.length === 0 && <div className="empty">Задач нет</div>}
          <table><tbody>
            {tasks.map((t) => <tr key={t.id}><td>{t.title}<div className="muted small">до {fmtDate(t.due_date)}</div></td><td style={{ textAlign: 'right' }}><Pill s={t.status} /></td></tr>)}
          </tbody></table>
        </div>
      </div>

      {isManager && (
        <div className="card">
          <h2>Команда: главный показатель месяца</h2>
          {team.length === 0 ? <div className="empty">Нет подчинённых или не задан план</div> : (
            <div className="tbl-wrap"><table>
              <thead><tr><th>Сотрудник</th><th>Роль</th><th>План</th><th>Факт</th><th>Выполнение</th><th>Статус</th></tr></thead>
              <tbody>{team.sort((a, b) => (a.pct ?? -1) - (b.pct ?? -1)).map((r) => (
                <tr key={r.owner_id}><td>{r.full_name}</td><td className="muted">{roleTitle(r.role_key)}</td><td>{num(r.plan)}</td><td>{num(r.fact)}</td>
                  <td style={{ minWidth: 120 }}>{r.pct !== null ? `${num(r.pct)}%` : '—'}<Progress pct={r.pct} status={r.status} /></td><td><Pill s={r.status} /></td></tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      )}

      <div className="grid g2">
        <div className="card">
          <h2>Рейтинг месяца</h2>
          <p className="muted small" style={{ marginTop: -6 }}>Баллы только за результат: % плана + задачи в срок ×2 + аудит/10 + похвала ×5</p>
          {lb.length === 0 && <div className="empty">Нет данных</div>}
          <table><tbody>{lb.map((r, i) => (
            <tr key={r.owner_id}><td style={{ width: 28 }}><b>{i + 1}</b></td><td>{r.full_name}{r.owner_id === profile!.id && <span className="pill info" style={{ marginLeft: 6 }}>вы</span>}</td>
              <td className="muted small">{r.pct !== null ? `${num(r.pct)}% плана` : 'нет плана'}</td><td style={{ textAlign: 'right' }}><b>{r.points}</b></td></tr>
          ))}</tbody></table>
        </div>
        <div className="card">
          <div className="row between"><h2>Признание</h2>{isManager && <button className="small" onClick={() => setPraiseOpen(true)}>Похвалить</button>}</div>
          {praises.length === 0 && <div className="empty">Пока пусто</div>}
          {praises.map((p) => <div key={p.id} className="reco" style={{ borderLeftColor: 'var(--ok)' }}><b>{name(p.to_id)}</b><p>{p.text} — {name(p.from_id)}</p></div>)}
        </div>
      </div>
      {praiseOpen && <Praise onClose={() => { setPraiseOpen(false); load(); }} />}
    </>
  );
}

function Praise({ onClose }: { onClose: () => void }) {
  const { profile, people } = useAuth();
  const [to, setTo] = useState(''); const [text, setText] = useState(''); const [err, setErr] = useState('');
  async function save() {
    if (!to || !text.trim()) return setErr('Выберите сотрудника и напишите за какой результат');
    const { error } = await supabase.from('praises').insert({ to_id: to, from_id: profile!.id, text: text.trim() });
    if (error) return setErr(errText(error));
    onClose();
  }
  return (
    <Modal title="Публичная похвала" onClose={onClose}>
      <Err text={err} />
      <Field label="Кому"><PersonSelect value={to} onChange={setTo} people={people.filter((p) => p.is_active && p.id !== profile!.id)} /></Field>
      <Field label="За какой результат (цифра)"><textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Например: закрыл 3 сделки за неделю, 120% плана" /></Field>
      <button className="primary" onClick={save}>Опубликовать</button>
    </Modal>
  );
}
