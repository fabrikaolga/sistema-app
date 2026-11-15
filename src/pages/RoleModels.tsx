import { useState } from 'react';
import { callFn, errText, ROLE_ORDER, type RoleKey } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Err } from '../components/ui';

// Модель работ роли: назначение, функции, день по часам, неделя, месяц, KPI, контроль, развитие, что делает система
export function RoleModelView({ m }: { m: any }) {
  if (!m) return <div className="empty">Модель для этой роли ещё не задана</div>;
  const list = (x: any[]) => <ul>{x.map((v, i) => <li key={i}>{typeof v === 'string' ? v : JSON.stringify(v)}</li>)}</ul>;
  return (
    <div>
      {m.purpose && <p><b>Назначение:</b> {m.purpose}</p>}
      {m.functions?.length > 0 && <><h3>Функции</h3>{list(m.functions)}</>}
      {m.day?.length > 0 && <><h3>День</h3><div className="tbl-wrap"><table><tbody>{m.day.map((x: any, i: number) => <tr key={i}><td style={{ width: 90 }}><b>{x.time}</b></td><td>{x.activity}</td></tr>)}</tbody></table></div></>}
      {m.week?.length > 0 && <><h3>Неделя</h3><div className="tbl-wrap"><table><tbody>{m.week.map((x: any, i: number) => <tr key={i}><td style={{ width: 90 }}><b>{x.day}</b></td><td>{x.activity}</td></tr>)}</tbody></table></div></>}
      {m.month?.length > 0 && <><h3>Месяц</h3>{list(m.month)}</>}
      {m.norms && <p><b>Нормативы:</b> {m.norms}</p>}
      {m.kpi?.length > 0 && <><h3>KPI</h3><div className="tbl-wrap"><table><thead><tr><th>Показатель</th><th>Цель</th><th>Правило зон</th></tr></thead><tbody>{m.kpi.map((x: any, i: number) => <tr key={i}><td>{x.name}</td><td>{x.target}</td><td className="small">{x.zone_rule}</td></tr>)}</tbody></table></div></>}
      {m.control?.length > 0 && <><h3>Контроль</h3>{list(m.control)}</>}
      {m.development?.length > 0 && <><h3>Развитие</h3>{list(m.development)}</>}
      {m.automated?.length > 0 && <><h3>Делает система</h3>{list(m.automated)}</>}
      {m.time_load && <p className="muted"><b>Нагрузка:</b> {m.time_load}</p>}
    </div>
  );
}

export default function RoleModels() {
  const { profile, company, roleTitle, isTop, reload } = useAuth();
  const models = (company?.config as any)?.role_models || {};
  const roles = ROLE_ORDER.filter((r) => models[r]);
  const [role, setRole] = useState<RoleKey>(roles.includes(profile!.role_key) ? profile!.role_key : (roles[0] || profile!.role_key));
  const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  async function gen() {
    setBusy(true); setErr('');
    try { await callFn('ai-coach', { action: 'role_models' }); await reload(); } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }
  return (
    <>
      <div className="row between"><div><h1>Модели работ</h1><p className="sub">Что, когда и как делает каждая роль. По этим моделям система планирует день, проверяет и учит.</p></div>
        {(isTop || profile!.is_superadmin) && <button disabled={busy} onClick={gen}>{busy ? 'Составляю (до 2 мин)…' : roles.length ? 'Обновить по базе знаний' : 'Составить модели по базе знаний'}</button>}</div>
      <Err text={err} />
      {roles.length === 0 ? <div className="card empty">Модели работ ещё не составлены{isTop ? ' — нажмите кнопку выше' : ''}.</div> : <>
        <div className="row">{roles.map((r) => <button key={r} className={role === r ? 'primary small' : 'small'} onClick={() => setRole(r)}>{roleTitle(r)}{r === profile!.role_key ? ' (вы)' : ''}</button>)}</div>
        <div className="card"><RoleModelView m={models[role]} /></div>
      </>}
    </>
  );
}
