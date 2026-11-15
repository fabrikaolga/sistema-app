import { useEffect, useRef, useState } from 'react';
import { supabase, callFn, errText, fmtDate, DEFAULT_ROLE_TITLES, type RoleKey } from '../lib/supabase';
import { BRIEF, ALL_Q, filled, type Q } from '../lib/briefQuestions';
import { Modal, Err, Field } from '../components/ui';
import { RoleModelView } from './RoleModels';

const CUR: Record<string, [string, string]> = { BY: ['BYN', 'Europe/Minsk'], RU: ['RUB', 'Europe/Moscow'], KZ: ['KZT', 'Asia/Almaty'], AE: ['AED', 'Asia/Dubai'], DE: ['EUR', 'Europe/Berlin'], US: ['USD', 'America/New_York'], IL: ['ILS', 'Asia/Jerusalem'], CA: ['CAD', 'America/Toronto'] };
const NORM_KEYS = ['calls_new', 'calls_existing', 'meetings', 'kp_sent'];

// Брифинг клиента «до костей»: анкета → уточняющие вопросы AI → проект системы → компания под ключ
export default function Briefs({ onCreated }: { onCreated?: () => void }) {
  const [list, setList] = useState<any[]>([]);
  const [cur, setCur] = useState<any | null>(null);
  const [err, setErr] = useState('');
  async function load() {
    const { data, error } = await supabase.from('client_briefs').select('*').order('updated_at', { ascending: false });
    if (error) return setErr(errText(error));
    setList(data || []);
  }
  useEffect(() => { load(); }, []);
  async function create() {
    const { data, error } = await supabase.from('client_briefs').insert({ title: 'Новый клиент' }).select().single();
    if (error) return setErr(errText(error));
    setCur(data);
  }
  if (cur) return <Editor brief={cur} onBack={() => { setCur(null); load(); }} onCreated={onCreated} />;
  return (
    <div className="card">
      <div className="row between"><h2>Брифы клиентов</h2><button className="primary" onClick={create}>Новый бриф</button></div>
      <Err text={err} />
      <div className="tbl-wrap"><table>
        <thead><tr><th>Клиент</th><th>Заполнено</th><th>Статус</th><th>Обновлён</th><th></th></tr></thead>
        <tbody>{list.length === 0 && <tr><td colSpan={5} className="empty">Брифов пока нет</td></tr>}
          {list.map((b) => <tr key={b.id}><td><b>{b.answers?.company_name || b.title}</b></td>
            <td>{Math.round(filled(b.answers) / ALL_Q.length * 100)}%</td>
            <td><span className={`pill ${b.status === 'created' ? 'ok' : b.status === 'designed' ? 'risk' : ''}`}>{{ draft: 'черновик', designed: 'проект готов', created: 'компания создана' }[b.status as string]}</span></td>
            <td>{fmtDate(b.updated_at.slice(0, 10))}</td><td><button className="small" onClick={() => setCur(b)}>Открыть</button></td></tr>)}</tbody>
      </table></div>
    </div>
  );
}

function Editor({ brief, onBack, onCreated }: { brief: any; onBack: () => void; onCreated?: () => void }) {
  const [a, setA] = useState<Record<string, any>>(brief.answers || {});
  const [xq, setXq] = useState<any[]>(brief.extra_questions || []);
  const [design, setDesign] = useState<any>(brief.design);
  const [open, setOpen] = useState<string>('company');
  const [busy, setBusy] = useState(''); const [err, setErr] = useState(''); const [saved, setSaved] = useState('');
  const [mk, setMk] = useState(false);
  const timer = useRef<any>(null);
  function save(next: Record<string, any>, nextXq = xq) {
    clearTimeout(timer.current);
    timer.current = setTimeout(async () => {
      const { error } = await supabase.from('client_briefs').update({ answers: next, extra_questions: nextXq, title: next.company_name || 'Новый клиент', updated_at: new Date().toISOString() }).eq('id', brief.id);
      setSaved(error ? 'ошибка сохранения' : 'сохранено');
    }, 700);
  }
  const set = (k: string, v: any) => { const n = { ...a, [k]: v }; setA(n); setSaved('…'); save(n); };
  async function ai(action: string) {
    setErr(''); setBusy(action);
    try {
      clearTimeout(timer.current);
      await supabase.from('client_briefs').update({ answers: a, extra_questions: xq }).eq('id', brief.id);
      const r = await callFn<any>('brief-ai', { action, brief_id: brief.id });
      if (action === 'questions') setXq(r.questions || []); else setDesign(r.design);
    } catch (e) { setErr(errText(e)); } finally { setBusy(''); }
  }
  const pct = Math.round(filled(a) / ALL_Q.length * 100);
  return (
    <>
      <div className="row between"><div><h1>{a.company_name || 'Новый клиент'}</h1><p className="sub">Заполнено {pct}% · {saved}</p></div>
        <button onClick={onBack}>К списку</button></div>
      <Err text={err} />
      {BRIEF.map((b) => {
        const n = b.qs.filter((q) => String(a[q.k] ?? '').trim()).length;
        return (
          <div className="card" key={b.id}>
            <div className="row between" style={{ cursor: 'pointer' }} onClick={() => setOpen(open === b.id ? '' : b.id)}>
              <h2 style={{ margin: 0 }}>{b.title}</h2><span className="muted small">{n}/{b.qs.length} {open === b.id ? '▲' : '▼'}</span></div>
            {open === b.id && <>
              <p className="muted small">{b.why}</p>
              {b.qs.map((q) => <QField key={q.k} q={q} v={a[q.k]} onChange={(v) => set(q.k, v)} />)}
            </>}
          </div>
        );
      })}

      <div className="card">
        <h2>Уточняющие вопросы системы</h2>
        <p className="muted small">AI сверяет ответы с базой знаний и находит пробелы и противоречия под нишу клиента.</p>
        <button disabled={!!busy || pct < 15} onClick={() => ai('questions')}>{busy === 'questions' ? 'Анализирую…' : 'Найти пробелы и задать вопросы'}</button>
        {xq.map((q, i) => <div key={i} className="field" style={{ marginTop: 10 }}>
          <label>{q.block ? <span className="muted">[{q.block}] </span> : null}{q.q}</label>
          {q.why && <div className="muted small">{q.why}</div>}
          <textarea value={q.answer || ''} onChange={(e) => { const n = xq.map((x, j) => j === i ? { ...x, answer: e.target.value } : x); setXq(n); setSaved('…'); save(a, n); }} />
        </div>)}
      </div>

      <div className="card">
        <h2>Проект системы под клиента</h2>
        <p className="muted small">Шаг 1 — диагностика, структура, график, план и воронка, нормативы и конверсии. Шаг 2 — модели работ по каждой роли, бизнес-ритм, чек-листы аудитов, техники продаж, план внедрения.</p>
        <div className="row">
          <button className="primary" disabled={!!busy || pct < 25} onClick={() => ai('design')}>{busy === 'design' ? 'Проектирую (до 2 мин)…' : 'Шаг 1: спроектировать'}</button>
          <button className="primary" disabled={!!busy || !design?.config} onClick={() => ai('design_roles')}>{busy === 'design_roles' ? 'Пишу модели работ (до 2 мин)…' : 'Шаг 2: модели работ и ритм'}</button>
          <button disabled={!design?.config?.role_models || brief.status === 'created'} onClick={() => setMk(true)}>Создать компанию</button>
        </div>
        {pct < 25 && <p className="muted small">Заполните хотя бы четверть брифа — иначе проект будет неточным.</p>}
      </div>
      {design && <DesignView d={design} onChange={(d) => { setDesign(d); supabase.from('client_briefs').update({ design: d }).eq('id', brief.id); }} />}
      {mk && <CreateCompany brief={brief} a={a} d={design} onClose={(ok) => { setMk(false); if (ok) { onCreated?.(); onBack(); } }} />}
    </>
  );
}

function QField({ q, v, onChange }: { q: Q; v: any; onChange: (v: any) => void }) {
  const id = 'q_' + q.k;
  return (
    <Field label={q.q} htmlFor={id}>
      {q.type === 'long' ? <textarea id={id} value={v || ''} onChange={(e) => onChange(e.target.value)} placeholder={q.hint} />
        : q.type === 'select' ? <select id={id} value={v || ''} onChange={(e) => onChange(e.target.value)}><option value="">—</option>{q.options!.map((o) => <option key={o}>{o}</option>)}</select>
        : <input id={id} type={q.type === 'number' ? 'number' : 'text'} value={v ?? ''} placeholder={q.hint} onChange={(e) => onChange(q.type === 'number' ? (e.target.value === '' ? '' : Number(e.target.value)) : e.target.value)} />}
    </Field>
  );
}

const L = ({ items }: { items?: any[] }) => items?.length ? <ul>{items.map((x, i) => <li key={i}>{typeof x === 'string' ? x : JSON.stringify(x)}</li>)}</ul> : null;

function DesignView({ d, onChange }: { d: any; onChange: (d: any) => void }) {
  const c = d.config || {};
  const roles = Object.keys(c.role_models || {});
  const [role, setRole] = useState(roles[0] || '');
  const setNorm = (k: string, v: number) => onChange({ ...d, config: { ...c, norms: { ...c.norms, seller: { ...c.norms?.seller, [k]: v } } } });
  return (
    <>
      <div className="card"><h2>Вывод</h2><p>{d.summary}</p>
        {d.check && <p className={d.check.ok ? 'muted' : 'err'}>Нагрузка менеджера по нормативам: {d.check.seller_load_pct}% рабочего дня ({d.check.seller_minutes} мин){d.check.ok ? '' : ' — перегруз, уменьшите нормативы'}</p>}</div>
      {d.diagnosis?.length > 0 && <div className="card"><h2>Диагностика</h2><div className="tbl-wrap"><table><thead><tr><th>Проблема</th><th>Причина</th><th>Влияние</th><th>Что делает система</th></tr></thead>
        <tbody>{d.diagnosis.map((x: any, i: number) => <tr key={i}><td>{x.problem}</td><td>{x.cause}</td><td>{x.effect}</td><td>{x.fix}</td></tr>)}</tbody></table></div></div>}
      {d.structure && <div className="card"><h2>Структура</h2><div className="tbl-wrap"><table><thead><tr><th>Роль</th><th>У клиента</th><th>Человек</th><th>Подчиняется</th><th>Зачем</th></tr></thead>
        <tbody>{Object.entries(d.structure.roles || {}).map(([k, r]: any) => <tr key={k}><td className="muted">{DEFAULT_ROLE_TITLES[k as RoleKey] || k}</td><td>{r.title}</td><td>{r.count}</td><td>{r.reports_to ? DEFAULT_ROLE_TITLES[r.reports_to as RoleKey] || r.reports_to : '—'}</td><td className="small">{r.why}</td></tr>)}</tbody></table></div>
        <L items={d.structure.changes} /><L items={d.structure.hiring} /></div>}
      <div className="card"><h2>График, план и воронка</h2>
        {d.work_hours && <p>{d.work_hours.days}, {d.work_hours.start}–{d.work_hours.end}{d.work_hours.lunch ? `, обед ${d.work_hours.lunch}` : ''}. {d.work_hours.notes}</p>}
        {d.plan && <p>План: {d.plan.deals} сделок, выручка {d.plan.revenue}, средний чек {d.plan.avg_check}. {d.plan.funnel}</p>}
        <h3>Нормативы менеджера в день (можно поправить)</h3>
        <div className="grid g3">{NORM_KEYS.map((k) => <div className="field" key={k}><label>{c.activity_titles?.[k] || k}</label>
          <input type="number" min="0" value={c.norms?.seller?.[k] ?? 0} onChange={(e) => setNorm(k, Number(e.target.value))} /></div>)}</div>
        <p className="muted small">Конверсии-цели: новый звонок → встреча {c.conversion?.conv_call_meeting}%, встреча → КП {c.conversion?.conv_meeting_kp}%, КП → сделка {c.conversion?.conv_kp_deal}%</p>
        {c.pipeline && <ol>{c.pipeline.map((s: any) => <li key={s.key}><b>{s.title}</b> — {s.exit} (до {s.max_days} дн.)</li>)}</ol>}
      </div>
      {c.rituals && <div className="card"><h2>Бизнес-ритм</h2><div className="tbl-wrap"><table><thead><tr><th>Мероприятие</th><th>Когда</th><th>Длит.</th><th>Ведёт</th><th>Повестка</th></tr></thead>
        <tbody>{c.rituals.map((r: any, i: number) => <tr key={i}><td><b>{r.name}</b></td><td>{r.when}</td><td>{r.duration}</td><td>{DEFAULT_ROLE_TITLES[r.owner_role as RoleKey] || r.owner_role}</td><td className="small">{(r.agenda || []).join('; ')}</td></tr>)}</tbody></table></div></div>}
      {roles.length > 0 && <div className="card"><h2>Модели работ по ролям</h2>
        <div className="row">{roles.map((r) => <button key={r} className={role === r ? 'primary small' : 'small'} onClick={() => setRole(r)}>{c.roles?.[r] || DEFAULT_ROLE_TITLES[r as RoleKey] || r}</button>)}</div>
        {role && <RoleModelView m={c.role_models[role]} />}</div>}
      {c.audits && <div className="card"><h2>Чек-листы аудита</h2>{c.audits.map((x: any, i: number) => <div key={i}><b>{x.title}</b><ul>{(x.items || []).map((it: any, j: number) => <li key={j}>{it.text} <span className="muted">×{it.weight}</span></li>)}</ul></div>)}</div>}
      {d.sales_techniques && <div className="card"><h2>Техники продаж</h2><div className="tbl-wrap"><table><thead><tr><th>Этап</th><th>Техника</th><th>Фраза</th></tr></thead>
        <tbody>{d.sales_techniques.map((t: any, i: number) => <tr key={i}><td>{t.stage}</td><td>{t.technique}</td><td className="small">{t.phrase}</td></tr>)}</tbody></table></div></div>}
      {(d.roadmap || d.automation || d.risks || d.open_questions) && <div className="card"><h2>Внедрение</h2>
        {d.roadmap?.map((w: any, i: number) => <div key={i}><b>Неделя {w.week}</b><L items={w.steps} /></div>)}
        {d.automation && <><h3>Автоматизирует система</h3><L items={d.automation} /></>}
        {d.risks && <><h3>Риски</h3><L items={d.risks} /></>}
        {d.open_questions && <><h3>Уточнить у клиента</h3><L items={d.open_questions} /></>}</div>}
    </>
  );
}

function CreateCompany({ brief, a, d, onClose }: { brief: any; a: Record<string, any>; d: any; onClose: (ok: boolean) => void }) {
  const [niches, setNiches] = useState<any[]>([]);
  const [f, setF] = useState({ name: a.company_name || '', niche: d?.niche_key || 'universal', director_name: '', director_email: '' });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false); const [done, setDone] = useState<any>(null);
  useEffect(() => { supabase.from('niche_templates').select('key,title').not('key', 'like', '\\_%').order('title').then(({ data }) => { setNiches(data || []); if (data && !data.some((n: any) => n.key === f.niche)) setF((x) => ({ ...x, niche: 'universal' })); }); }, []);
  const country = CUR[a.country] ? a.country : 'BY';
  async function go() {
    setErr('');
    if (!f.name.trim() || !f.director_name.trim() || !f.director_email.trim()) return setErr('Заполните компанию, ФИО и почту директора');
    setBusy(true);
    try {
      const c = d.config || {};
      const clean = (o: any) => Object.fromEntries(Object.entries(o || {}).filter(([k]) => NORM_KEYS.includes(k)).map(([k, v]) => [k, Math.max(0, Number(v) || 0)]));
      const norms = Object.fromEntries(Object.entries(c.norms || {}).filter(([r]) => r in DEFAULT_ROLE_TITLES).map(([r, v]) => [r, clean(v)]));
      const config: any = { roles: c.roles, activity_titles: c.activity_titles, norms, conversion: c.conversion, time_override: Object.fromEntries(Object.entries(clean(c.time_override)).filter(([, v]) => Number(v) > 0)), pipeline: c.pipeline,
        channels: c.channels, client_types: c.client_types, objections: c.objections, loss_reasons: c.loss_reasons, rituals: c.rituals, audits: c.audits,
        role_models: c.role_models, work_hours: d.work_hours, sales_techniques: d.sales_techniques, plan: d.plan };
      if (Number(c.capacity_min_day) > 0) config.capacity_min_day = Number(c.capacity_min_day);
      Object.keys(config).forEach((k) => (config[k] === undefined || config[k] === null) && delete config[k]);
      const staff = Object.fromEntries(Object.keys(DEFAULT_ROLE_TITLES).map((r) => [r, Number(a['n_' + r]) || 0]));
      const r = await callFn<any>('companies', { action: 'create', name: f.name.trim(), niche: f.niche, country, currency: CUR[country][0], timezone: a.timezone || CUR[country][1],
        director_name: f.director_name.trim(), director_email: f.director_email.trim(), brief: { request: a.request || '', staff, brief_id: brief.id, summary: d.summary, config } });
      await supabase.from('client_briefs').update({ company_id: r.company_id, status: 'created' }).eq('id', brief.id);
      setDone(r);
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }
  if (done) return (
    <Modal title="Компания создана" onClose={() => onClose(true)}>
      <p>Структура, роли, нормативы, конверсии, воронка, ритм, чек-листы и модели работ по ролям настроены по брифу. Передайте директору доступ лично.</p>
      <div className="secret">Вход: {location.origin + location.pathname}<br />Почта: {done.email}<br />Временный пароль: {done.temp_password}</div>
      <div className="row" style={{ marginTop: 14 }}><button onClick={() => navigator.clipboard.writeText(`Вход в СИСТЕМУ: ${location.origin + location.pathname}\nПочта: ${done.email}\nВременный пароль: ${done.temp_password}`)}>Скопировать</button>
        <button className="primary" onClick={() => onClose(true)}>Готово</button></div>
    </Modal>
  );
  return (
    <Modal title="Создать компанию по проекту" onClose={() => onClose(false)}>
      <Err text={err} />
      <Field label="Компания" htmlFor="cn"><input id="cn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <Field label="Шаблон ниши (основа, поверх — проект)" htmlFor="cni"><select id="cni" value={f.niche} onChange={(e) => setF({ ...f, niche: e.target.value })}>{niches.map((n) => <option key={n.key} value={n.key}>{n.title}</option>)}</select></Field>
      {country === 'RU' && <div className="err">Для клиентов из РФ по 152-ФЗ персональные данные нужно хранить на сервере в РФ. Согласуйте перед продажей.</div>}
      <div className="grid g2">
        <Field label="ФИО директора" htmlFor="cdn"><input id="cdn" value={f.director_name} onChange={(e) => setF({ ...f, director_name: e.target.value })} /></Field>
        <Field label="Почта директора" htmlFor="cde"><input id="cde" type="email" value={f.director_email} onChange={(e) => setF({ ...f, director_email: e.target.value })} /></Field>
      </div>
      <button className="primary" disabled={busy} onClick={go}>Создать</button>
    </Modal>
  );
}
