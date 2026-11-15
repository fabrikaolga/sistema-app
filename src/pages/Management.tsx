import { useEffect, useState } from 'react';
import { supabase, errText, fmtDate, today, callFn } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Modal, Err, Field } from '../components/ui';
import { CreateTask } from './Tasks';

export const KIND: Record<string, string> = {
  morning: 'Утренняя летучка', evening: 'Вечерний контроль', interim: 'Промежуточный контроль', team_meeting: 'Встреча с командой',
  br_setup: 'Установочное Business Review', br_red: 'BR: выход из красной зоны', pd: 'Performance Dialogue (итоги месяца)',
  quarter_fb: 'Квартальная обратная связь', newbie_hour: 'Час новичка', mentoring: 'Сессия наставничества', tech_study: 'Техническая учёба', mastermind: 'Mastermind',
  one_on_one: 'Встреча 1-на-1 (30 мин)', field_visit: 'Полевой визит: наставничество руководителя',
};
const CAUSE: Record<string, string> = {
  dont_know: 'Не знает', cant: 'Не умеет', distracted: 'Отвлекается', overloaded: 'Не успевает (перегружен)',
  no_report: 'Не отмечает отчёт', violates_model: 'Не соблюдает модель / ЛПА',
};
const CAT: Record<string, string> = { sales_skills: 'Навыки продаж', team: 'Команда', quality: 'Качество', crm_hygiene: 'Гигиена CRM', fraud: 'Фрод', rhythm: 'Бизнес-ритм' };
const ZONE: Record<string, string> = { green: 'ok', yellow: 'risk', red: 'fail' };

// Регулярный менеджмент: календарь мероприятий + отклонения + ЭД
export default function Management() {
  const { isManager } = useAuth();
  const [tab, setTab] = useState<'today' | 'deviations' | 'ed'>(isManager ? 'today' : 'ed');
  return (
    <>
      <h1>Регулярный менеджмент</h1>
      <p className="sub">Система сама планирует мероприятия по Модели работ, считает зоны и открывает отклонения. Руководитель ставит причину — система назначает меру и контролирует.</p>
      <div className="tabs">
        {isManager && <button className={tab === 'today' ? 'on' : ''} onClick={() => setTab('today')}>Мероприятия</button>}
        <button className={tab === 'deviations' ? 'on' : ''} onClick={() => setTab('deviations')}>Отклонения</button>
        <button className={tab === 'ed' ? 'on' : ''} onClick={() => setTab('ed')}>Мой день (ЭД)</button>
      </div>
      {tab === 'today' && <Events />}
      {tab === 'deviations' && <Deviations />}
      {tab === 'ed' && <DailyActivity />}
    </>
  );
}

function Events() {
  const { profile, people } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [open, setOpen] = useState<any>(null);
  const [err, setErr] = useState('');
  const name = (id: string) => people.find((p) => p.id === id)?.full_name || 'вся команда';
  async function load() {
    const from = new Date(); from.setDate(from.getDate() - 7);
    const to = new Date(); to.setDate(to.getDate() + 7);
    const { data, error } = await supabase.from('rm_events').select('*').eq('host_id', profile!.id)
      .gte('scheduled_for', from.toISOString().slice(0, 10)).lte('scheduled_for', to.toISOString().slice(0, 10)).order('scheduled_for');
    if (error) setErr(errText(error)); else setRows(data || []);
  }
  useEffect(() => { load(); }, []);
  const t = today();
  const groups = [['Сегодня', rows.filter((r) => r.scheduled_for === t)], ['Просрочено', rows.filter((r) => r.scheduled_for < t && r.status === 'planned' || r.status === 'missed')],
    ['Впереди', rows.filter((r) => r.scheduled_for > t)], ['Проведено', rows.filter((r) => r.status === 'done')]] as [string, any[]][];
  const done = rows.filter((r) => r.scheduled_for <= t && r.status === 'done').length;
  const due = rows.filter((r) => r.scheduled_for <= t && r.status !== 'cancelled').length;
  return (
    <>
      <Err text={err} />
      <div className="grid g3">
        <div className="card stat"><div className="k">Соблюдение бизнес-ритма (7 дней)</div><div className="v">{due ? Math.round(done / due * 100) : 100}%</div><div className="d">{done} из {due} мероприятий проведено</div></div>
      </div>
      {groups.map(([title, list]) => list.length > 0 && (
        <div className="card" key={title}><h2>{title} ({list.length})</h2><table><tbody>
          {list.map((e) => <tr key={e.id}><td>{fmtDate(e.scheduled_for)}</td><td><b>{KIND[e.kind]}</b><div className="muted small">{name(e.participant_id)}</div></td>
            <td><span className={`pill ${e.status === 'done' ? 'ok' : e.status === 'missed' ? 'fail' : 'info'}`}>{e.status === 'done' ? 'Проведено' : e.status === 'missed' ? 'Пропущено' : 'Запланировано'}</span></td>
            <td style={{ textAlign: 'right' }}>{e.status !== 'done' && <button className="small primary" onClick={() => setOpen(e)}>Провести</button>}</td></tr>)}
        </tbody></table></div>
      ))}
      {rows.length === 0 && <div className="card empty">Мероприятий нет. Календарь формируется каждый рабочий день в 06:00 по команде.</div>}
      {open && <Conduct ev={open} onClose={(c) => { setOpen(null); if (c) load(); }} />}
    </>
  );
}

const AGENDA: Record<string, string[]> = {
  morning: ['Проверен файл ЭД сотрудника', 'Поставлены задачи на день по активностям', 'Обсуждены сделки в работе', 'Скорректирован план дня'],
  evening: ['Сверен факт активностей с планом дня', 'Разобраны невыполненные задачи', 'Назначены шаги на завтра'],
  team_meeting: ['Новости и изменения', 'Итоги недели против нормы', 'Действия на неделю для выхода в норматив', 'Выбран лучший сотрудник недели', 'Кому помогаю на неделе'],
  br_setup: ['Текущее выполнение показателей', 'Достаточность пайплайна', 'Мероприятия на месяц больше Run Rate', 'Поручения со сроками'],
  br_red: ['Выполнение поручений прошлого BR', 'Причина отклонения подтверждена', 'План мероприятий на неделю', 'Дата контроля'],
  pd: ['Итоги месяца по показателям', 'TOP/BOTTOM, работа с отклонениями', 'Прогноз на следующий месяц'],
  quarter_fb: ['Оценка эффективности и ценностей (5+)', 'Зоны развития', 'Планы на квартал', 'Договорённости зафиксированы'],
  newbie_hour: ['Как дела, повод для гордости', 'Что нового изучил', 'Закреплён материал на примерах', 'План обучения на неделю'],
  mentoring: ['Наблюдение за работой', 'Демонстрация «как надо»', 'Отработка навыка (ролевая игра)', 'Конкретные рекомендации'],
  interim: ['Факт активностей на середину дня', 'Что мешает выйти в норму сегодня', 'Корректировка плана до конца дня'],
  one_on_one: ['Зоны и динамика за неделю', 'Разбор 1 сделки или звонка', 'Выполнение договорённостей', 'Цель на неделю с цифрой'],
  field_visit: ['Наблюдал проведение летучки/BR руководителем', 'Разобрал причины западаний группы', 'Показал «как надо» на практике', 'Рекомендации по SMART со сроками'],
};

function Conduct({ ev, onClose }: { ev: any; onClose: (c: boolean) => void }) {
  const items = AGENDA[ev.kind] || ['Цель встречи достигнута'];
  const [chk, setChk] = useState<boolean[]>(items.map(() => false));
  const [protocol, setProtocol] = useState(''); const [err, setErr] = useState('');
  const [task, setTask] = useState(false);
  async function save() {
    if (protocol.trim().length < 10) return setErr('Зафиксируйте решения и договорённости');
    const { error } = await supabase.from('rm_events').update({ status: 'done', protocol: protocol.trim(), checklist: items.map((t, i) => ({ t, ok: chk[i] })), done_at: new Date().toISOString() }).eq('id', ev.id);
    if (error) return setErr(errText(error));
    onClose(true);
  }
  return (
    <Modal title={KIND[ev.kind]} onClose={() => onClose(false)}>
      <Err text={err} />
      {items.map((t, i) => <label className="chk" key={i} style={{ fontWeight: 400, color: 'var(--ink)', fontSize: 14 }}><input type="checkbox" checked={chk[i]} onChange={(e) => setChk(chk.map((x, k) => k === i ? e.target.checked : x))} /> {t}</label>)}
      <Field label="Протокол: решения и договорённости"><textarea value={protocol} onChange={(e) => setProtocol(e.target.value)} /></Field>
      <div className="row"><button className="primary" onClick={save}>Завершить</button><button onClick={() => setTask(true)}>Решение → задача</button></div>
      {task && <CreateTask preset={{ source: 'meeting', assignee_id: ev.participant_id || undefined }} onClose={() => setTask(false)} />}
    </Modal>
  );
}

function Deviations() {
  const { profile, people, isManager } = useAuth();
  const [rows, setRows] = useState<any[]>([]);
  const [snaps, setSnaps] = useState<any[]>([]);
  const [diag, setDiag] = useState<any>(null);
  const [coach, setCoach] = useState<any>(null);
  const [err, setErr] = useState('');
  const name = (id: string) => people.find((p) => p.id === id)?.full_name || '—';
  async function load() {
    const [a, b] = await Promise.all([supabase.from('deviation_cases').select('*').order('created_at', { ascending: false }),
      supabase.from('performance_snapshots').select('*').order('period_start', { ascending: false }).limit(400)]);
    if (a.error) return setErr(errText(a.error));
    setRows(a.data || []); setSnaps(b.data || []);
  }
  useEffect(() => { load(); }, []);
  const lastWeek = snaps[0]?.period_start;
  const zoneRows = snaps.filter((s) => s.period_start === lastWeek);
  const people2 = [...new Set(zoneRows.map((s) => s.owner_id))];
  const metrics = [...new Set(zoneRows.map((s) => s.metric_key))];
  return (
    <>
      <Err text={err} />
      {lastWeek && <div className="card"><h2>Зоны за неделю с {fmtDate(lastWeek)}</h2><div className="tbl-wrap"><table>
        <thead><tr><th>Сотрудник</th>{metrics.map((m) => <th key={m}>{m}</th>)}</tr></thead>
        <tbody>{people2.map((pid) => <tr key={pid}><td>{name(pid)}</td>{metrics.map((m) => { const s = zoneRows.find((x) => x.owner_id === pid && x.metric_key === m);
          return <td key={m}>{s ? <span className={`pill ${ZONE[s.zone]}`}>{s.pct}%</span> : '—'}</td>; })}</tr>)}</tbody>
      </table></div><p className="muted small">Зелёная ≥100%, жёлтая 85–99,9%, красная &lt;85% от нормы. Отклонение — красная зона 2 недели подряд.</p></div>}
      <div className="card"><h2>Отклонения</h2><div className="tbl-wrap"><table>
        <thead><tr><th>Сотрудник</th><th>Отклонение</th><th>Тип</th><th>Причина и мера</th><th>Статус</th><th></th></tr></thead>
        <tbody>{rows.length === 0 && <tr><td colSpan={6} className="empty">Системных отклонений нет</td></tr>}
          {rows.map((c) => <tr key={c.id}><td>{name(c.owner_id)}</td><td>{c.title}<div className="muted small">срок {fmtDate(c.due_date)}{c.escalation_level ? ` · эскалация ур. ${c.escalation_level}` : ''}</div></td>
            <td>{CAT[c.category]}</td><td className="small">{c.cause ? <><b>{CAUSE[c.cause]}</b>{c.auto_applied && <span className="pill neutral" style={{ marginLeft: 6 }}>назначено системой</span>}<br />{c.measure}</> : <span className="muted">Система предлагает: <b>{CAUSE[c.suggested_cause] || '—'}</b></span>}</td>
            <td><span className={`pill ${c.status === 'closed' ? 'ok' : c.status === 'escalated' ? 'fail' : c.status === 'new' ? 'risk' : 'info'}`}>{({ new: 'Новое', diagnosed: 'Диагноз', in_work: 'В работе', escalated: 'Эскалировано', closed: 'Закрыто' } as any)[c.status]}</span></td>
            <td><div className="row">{isManager && c.owner_id !== profile!.id && c.status !== 'closed' && <button className="small primary" onClick={() => setDiag(c)}>Причина</button>}
              {isManager && <button className="small" onClick={() => setCoach(c)}>AI-разбор</button>}</div></td></tr>)}
        </tbody></table></div></div>
      {diag && <Diagnose c={diag} onClose={(ch) => { setDiag(null); if (ch) load(); }} />}
      {coach && <Coach personId={coach.owner_id} onClose={() => setCoach(null)} />}
    </>
  );
}

function Diagnose({ c, onClose }: { c: any; onClose: (c: boolean) => void }) {
  const [cause, setCause] = useState(c.suggested_cause || ''); const [comment, setComment] = useState(''); const [err, setErr] = useState('');
  async function save() {
    const { error } = await supabase.rpc('diagnose_case', { p_case: c.id, p_cause: cause, p_comment: comment || null });
    if (error) return setErr(errText(error));
    onClose(true);
  }
  return (
    <Modal title="Диагностика отклонения" onClose={() => onClose(false)}>
      <p className="muted">{c.title}</p><Err text={err} />
      <Field label="Причина (по матрице мероприятий)"><select value={cause} onChange={(e) => setCause(e.target.value)}><option value="">Выберите</option>{Object.entries(CAUSE).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
      <Field label="Комментарий"><textarea value={comment} onChange={(e) => setComment(e.target.value)} placeholder="На чём основан вывод" /></Field>
      <button className="primary" disabled={!cause} onClick={save}>Назначить меру</button>
    </Modal>
  );
}

export function Coach({ personId, onClose }: { personId: string; onClose: () => void }) {
  const [text, setText] = useState(''); const [prov, setProv] = useState(''); const [err, setErr] = useState('');
  useEffect(() => { callFn<{ text: string; provider: string }>('ai-coach', { action: 'coach', person_id: personId })
    .then((r) => { setText(r.text); setProv(r.provider); }).catch((e) => setErr(errText(e))); }, []);
  return (
    <Modal title="AI-наставник: разбор" onClose={onClose}>
      <Err text={err} />
      {!text && !err && <div className="muted">Анализирую данные…</div>}
      {text && <div style={{ whiteSpace: 'pre-wrap', fontSize: 14 }}>{text}</div>}
      {prov && <p className="muted small" style={{ marginTop: 12 }}>Модель: {prov}. Это рекомендация, решение за руководителем.</p>}
    </Modal>
  );
}

function DailyActivity() {
  const { profile } = useAuth();
  const [norms, setNorms] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [facts, setFacts] = useState<Record<string, number>>({});
  const [week, setWeek] = useState<Record<string, number>>({});
  const [err, setErr] = useState('');
  const t = today();
  async function load() {
    const monday = new Date(); monday.setDate(monday.getDate() - ((monday.getDay() + 6) % 7));
    const [n, m, f] = await Promise.all([
      supabase.from('activity_norms').select('*').eq('role_key', profile!.role_key),
      supabase.from('metrics').select('*'),
      supabase.from('facts').select('metric_key, value, fact_date').eq('owner_id', profile!.id).gte('fact_date', monday.toISOString().slice(0, 10)),
    ]);
    if (n.error) return setErr(errText(n.error));
    setNorms(n.data || []); setMetrics(m.data || []);
    const d: Record<string, number> = {}; const w: Record<string, number> = {};
    (f.data || []).forEach((x: any) => { w[x.metric_key] = (w[x.metric_key] || 0) + Number(x.value); if (x.fact_date === t) d[x.metric_key] = (d[x.metric_key] || 0) + Number(x.value); });
    setFacts(d); setWeek(w);
  }
  useEffect(() => { load(); }, []);
  async function add(metric: string, v: number) {
    const { error } = await supabase.from('facts').insert({ owner_id: profile!.id, metric_key: metric, fact_date: t, value: v });
    if (error) setErr(errText(error)); else load();
  }
  const title = (k: string) => metrics.find((m) => m.key === k)?.title || k;
  const dayIdx = Math.min(((new Date().getDay() + 6) % 7) + 1, 5);
  if (!norms.length) return <div className="card empty">Для вашей роли нормативы активностей не заданы.</div>;
  return (
    <>
      <Err text={err} />
      <p className="muted small">Отмечайте каждое действие сразу — файл ЭД не нужен, руководитель видит факт онлайн. Норматив можно не выполнить в отдельный день, но не за неделю.</p>
      <div className="grid g2">{norms.map((n) => {
        const d = facts[n.metric_key] || 0; const w = week[n.metric_key] || 0; const wn = Number(n.per_day) * dayIdx;
        const pct = wn ? Math.round(w / wn * 100) : 0; const zone = pct >= 100 ? 'ok' : pct >= 85 ? 'risk' : 'fail';
        return (
          <div className="card stat" key={n.metric_key}>
            <div className="k">{title(n.metric_key)}</div>
            <div className="v">{d} <span className="muted" style={{ fontSize: 14, fontWeight: 400 }}>/ {n.per_day} сегодня</span></div>
            <div className="d">Неделя: {w} из {wn} <span className={`pill ${zone}`}>{pct}%</span></div>
            <div className="row" style={{ marginTop: 10 }}><button className="primary" onClick={() => add(n.metric_key, 1)}>+1</button><button onClick={() => add(n.metric_key, 5)}>+5</button></div>
          </div>
        );
      })}</div>
    </>
  );
}
