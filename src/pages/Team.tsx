import { useEffect, useState } from 'react';
import { supabase, callFn, errText, ROLE_ORDER, today, type Profile, type RoleKey } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Modal, Err, Field, PersonSelect } from '../components/ui';

const CAN_CREATE: Record<string, RoleKey[]> = {
  director: ['assistant_director', 'head_manager', 'team_lead', 'seller', 'assistant'],
  assistant_director: ['head_manager', 'team_lead', 'seller', 'assistant'],
  head_manager: ['team_lead', 'seller', 'assistant'],
  team_lead: ['seller', 'assistant'],
};

export default function Team() {
  const { profile, people, roleTitle, isManager, isTop, reload } = useAuth();
  const [add, setAdd] = useState(false);
  const [deact, setDeact] = useState<Profile | null>(null);
  const [move, setMove] = useState<Profile | null>(null);
  const [showOff, setShowOff] = useState(false);
  const list = people.filter((p) => showOff || p.is_active);
  const roots = list.filter((p) => !p.manager_id || !list.some((x) => x.id === p.manager_id));
  const children = (id: string) => list.filter((p) => p.manager_id === id);

  function Node({ p }: { p: Profile }) {
    const kids = children(p.id);
    const mine = p.id !== profile!.id && isManager;
    return (
      <li>
        <span className={`node ${p.is_active ? '' : 'off'}`}>
          <span><b>{p.full_name}</b> <span className="muted small">· {roleTitle(p.role_key)}{p.is_active ? '' : ' · деактивирован'}</span></span>
          {p.is_active && mine && <button className="small" onClick={() => setDeact(p)}>Деактивировать</button>}
          {p.is_active && isTop && p.role_key !== 'director' && <button className="small" onClick={() => setMove(p)}>Руководитель</button>}
        </span>
        {kids.length > 0 && <ul>{kids.map((k) => <Node key={k.id} p={k} />)}</ul>}
      </li>
    );
  }

  return (
    <>
      <div className="row between"><div><h1>Команда</h1><p className="sub">Иерархия: каждый видит и проверяет всё ниже себя</p></div>
        <div className="row">
          <label className="row small" style={{ margin: 0, fontWeight: 400 }}><input type="checkbox" style={{ width: 'auto' }} checked={showOff} onChange={(e) => setShowOff(e.target.checked)} /> показать уволенных</label>
          {CAN_CREATE[profile!.role_key] && <button className="primary" onClick={() => setAdd(true)}>Добавить сотрудника</button>}
        </div>
      </div>
      <div className="card tree"><ul>{roots.map((r) => <Node key={r.id} p={r} />)}</ul></div>
      <Workload />
      <div className="card"><h2>Состав</h2><div className="tbl-wrap"><table>
        <thead><tr><th>Роль</th><th>Человек</th></tr></thead>
        <tbody>{ROLE_ORDER.map((rk) => { const n = people.filter((p) => p.is_active && p.role_key === rk).length; return n ? <tr key={rk}><td>{roleTitle(rk)}</td><td>{n}</td></tr> : null; })}</tbody>
      </table></div></div>
      {add && <AddEmployee onClose={async (changed) => { setAdd(false); if (changed) await reload(); }} />}
      {deact && <Deactivate target={deact} onClose={async (c) => { setDeact(null); if (c) await reload(); }} />}
      {move && <MoveManager target={move} onClose={async (c) => { setMove(null); if (c) await reload(); }} />}
    </>
  );
}

function AddEmployee({ onClose }: { onClose: (changed: boolean) => void }) {
  const { profile, people, roleTitle } = useAuth();
  const roles = CAN_CREATE[profile!.role_key] || [];
  const [f, setF] = useState({ full_name: '', email: '', role_key: roles[roles.length - 2] || roles[0], manager_id: profile!.id });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<{ email: string; password: string } | null>(null);
  const managers = people.filter((p) => p.is_active && ['director', 'assistant_director', 'head_manager', 'team_lead'].includes(p.role_key));

  async function save() {
    setErr(''); setBusy(true);
    try {
      const r = await callFn<{ email: string; temp_password: string }>('employees', { action: 'create', ...f });
      setDone({ email: r.email, password: r.temp_password });
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }
  if (done) return (
    <Modal title="Сотрудник добавлен" onClose={() => onClose(true)}>
      <p>Передайте сотруднику данные для входа лично. Пароль показывается один раз, при первом входе система попросит заменить его.</p>
      <div className="secret">Почта: {done.email}<br />Временный пароль: {done.password}<br />Вход: {location.origin + location.pathname}</div>
      <div className="row" style={{ marginTop: 14 }}>
        <button onClick={() => navigator.clipboard.writeText(`Вход в СИСТЕМУ: ${location.origin + location.pathname}\nПочта: ${done.email}\nВременный пароль: ${done.password}`)}>Скопировать</button>
        <button className="primary" onClick={() => onClose(true)}>Готово</button>
      </div>
    </Modal>
  );
  return (
    <Modal title="Новый сотрудник" onClose={() => onClose(false)}>
      <Err text={err} />
      <Field label="ФИО" htmlFor="fn"><input id="fn" value={f.full_name} onChange={(e) => setF({ ...f, full_name: e.target.value })} /></Field>
      <Field label="Рабочая почта" htmlFor="em"><input id="em" type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
      <Field label="Роль" htmlFor="rl"><select id="rl" value={f.role_key} onChange={(e) => setF({ ...f, role_key: e.target.value as RoleKey })}>
        {roles.map((r) => <option key={r} value={r}>{roleTitle(r)}</option>)}</select></Field>
      <Field label="Руководитель"><PersonSelect value={f.manager_id} onChange={(v) => setF({ ...f, manager_id: v })} people={managers} /></Field>
      <button className="primary" disabled={busy} onClick={save}>Создать доступ</button>
    </Modal>
  );
}

function Deactivate({ target, onClose }: { target: Profile; onClose: (c: boolean) => void }) {
  const { people } = useAuth();
  const [succ, setSucc] = useState(target.manager_id || ''); const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  async function go() {
    setErr(''); setBusy(true);
    try { await callFn('employees', { action: 'deactivate', target_id: target.id, successor_id: succ }); onClose(true); }
    catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }
  return (
    <Modal title={`Деактивировать: ${target.full_name}`} onClose={() => onClose(false)}>
      <p className="muted">Доступ закроется сразу. Открытые сделки и незакрытые задачи перейдут преемнику, подчинённые — к вышестоящему руководителю. История сохранится.</p>
      <Err text={err} />
      <Field label="Преемник"><PersonSelect value={succ} onChange={setSucc} people={people.filter((p) => p.is_active && p.id !== target.id)} /></Field>
      <button className="primary danger" disabled={busy || !succ} onClick={go}>Деактивировать</button>
    </Modal>
  );
}

function MoveManager({ target, onClose }: { target: Profile; onClose: (c: boolean) => void }) {
  const { people } = useAuth();
  const [m, setM] = useState(target.manager_id || ''); const [err, setErr] = useState('');
  async function go() {
    const { error } = await supabase.rpc('set_manager', { p_target: target.id, p_manager: m || null });
    if (error) return setErr(errText(error));
    onClose(true);
  }
  return (
    <Modal title={`Руководитель: ${target.full_name}`} onClose={() => onClose(false)}>
      <Err text={err} />
      <Field label="Новый руководитель"><PersonSelect value={m} onChange={setM} people={people.filter((p) => p.is_active && p.id !== target.id && p.role_key !== 'seller' && p.role_key !== 'assistant')} /></Field>
      <button className="primary" onClick={go}>Сохранить</button>
    </Modal>
  );
}

// Нагрузка: плановое время по нормативам и мероприятиям против рабочего дня; размер команды против нормы управляемости
function Workload() {
  const { roleTitle } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  useEffect(() => { supabase.rpc('workload', { p_day: today() }).then(({ data }) => setRows(data || [])); }, []);
  if (!rows.length) return null;
  return (
    <div className="card"><h2>Нагрузка и управляемость</h2><div className="tbl-wrap"><table>
      <thead><tr><th>Сотрудник</th><th>Роль</th><th>План, ч/день</th><th>Загрузка</th><th>Подчинённых</th></tr></thead>
      <tbody>{rows.sort((a, b) => b.load_pct - a.load_pct).map((r) => <tr key={r.owner_id}><td>{r.full_name}</td><td className="muted">{roleTitle(r.role_key)}</td>
        <td>{(r.minutes / 60).toFixed(1)} из {(r.capacity / 60).toFixed(0)}</td>
        <td><span className={`pill ${r.load_pct > 100 ? 'fail' : r.load_pct > 85 ? 'risk' : 'ok'}`}>{r.load_pct}%</span></td>
        <td>{r.team_size ? <span className={`pill ${r.team_size > 10 ? 'fail' : r.team_size > 8 ? 'risk' : 'ok'}`}>{r.team_size}</span> : '—'}</td></tr>)}</tbody>
    </table></div><p className="muted small">Норма управляемости: до 8 подчинённых на руководителя (максимум 10), индивидуальная работа не меньше 30 минут в неделю на человека. Загрузка выше 100% — сигнал перераспределить нормативы или задачи.</p></div>
  );
}
