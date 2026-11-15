import { useEffect, useState } from 'react';
import { supabase, callFn, errText, fmtDate, DEFAULT_ROLE_TITLES, ROLE_ORDER } from '../lib/supabase';
import { Modal, Err, Field } from '../components/ui';

const COUNTRIES: [string, string, string, string][] = [
  ['BY', 'Беларусь', 'BYN', 'Europe/Minsk'], ['RU', 'Россия', 'RUB', 'Europe/Moscow'], ['KZ', 'Казахстан', 'KZT', 'Asia/Almaty'],
  ['AE', 'ОАЭ', 'AED', 'Asia/Dubai'], ['DE', 'Германия', 'EUR', 'Europe/Berlin'], ['US', 'США', 'USD', 'America/New_York'],
  ['IL', 'Израиль', 'ILS', 'Asia/Jerusalem'], ['CA', 'Канада', 'CAD', 'America/Toronto'],
];

export default function Admin() {
  const [companies, setCompanies] = useState<any[]>([]);
  const [counts, setCounts] = useState<Record<string, number>>({});
  const [niches, setNiches] = useState<any[]>([]);
  const [open, setOpen] = useState(false);
  const [err, setErr] = useState('');
  async function load() {
    const [c, n, p] = await Promise.all([
      supabase.from('companies').select('*').order('created_at', { ascending: false }),
      supabase.from('niche_templates').select('key,title').neq('key', '__base').order('title'),
      supabase.from('profiles').select('company_id').eq('is_active', true),
    ]);
    if (c.error) return setErr(errText(c.error));
    setCompanies(c.data || []); setNiches(n.data || []);
    const cnt: Record<string, number> = {}; (p.data || []).forEach((x: any) => { if (x.company_id) cnt[x.company_id] = (cnt[x.company_id] || 0) + 1; }); setCounts(cnt);
  }
  useEffect(() => { load(); }, []);
  const nicheTitle = (k: string) => niches.find((n) => n.key === k)?.title || k;
  return (
    <>
      <div className="row between"><div><h1>Компании клиентов</h1><p className="sub">Каждый клиент — изолированная компания со своей нишей, ролями и данными</p></div>
        <button className="primary" onClick={() => setOpen(true)}>Новый клиент по брифу</button></div>
      <Err text={err} />
      <div className="card"><div className="tbl-wrap"><table>
        <thead><tr><th>Компания</th><th>Ниша</th><th>Страна</th><th>Сотрудников</th><th>Запрос клиента</th><th>Создана</th></tr></thead>
        <tbody>{companies.length === 0 && <tr><td colSpan={6} className="empty">Клиентов пока нет</td></tr>}
          {companies.map((c) => <tr key={c.id}><td><b>{c.name}</b></td><td>{nicheTitle(c.niche_key)}</td><td>{c.country}</td><td>{counts[c.id] || 0}</td>
            <td className="muted small" style={{ maxWidth: 300 }}>{c.brief?.request || ''}</td><td>{fmtDate(c.created_at.slice(0, 10))}</td></tr>)}</tbody>
      </table></div></div>
      {open && <Brief niches={niches} onClose={(c) => { setOpen(false); if (c) load(); }} />}
    </>
  );
}

function Brief({ niches, onClose }: { niches: any[]; onClose: (c: boolean) => void }) {
  const [f, setF] = useState<any>({ name: '', niche: niches[0]?.key || 'universal', country: 'BY', director_name: '', director_email: '', request: '', staff: { head_manager: 0, team_lead: 1, seller: 5, assistant: 0, assistant_director: 0 } });
  const [err, setErr] = useState(''); const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<any>(null);
  const c = COUNTRIES.find((x) => x[0] === f.country)!;
  async function save() {
    setErr('');
    if (!f.name.trim() || !f.director_name.trim() || !f.director_email.trim()) return setErr('Заполните компанию, ФИО и почту директора');
    setBusy(true);
    try {
      const r = await callFn('companies', { action: 'create', name: f.name.trim(), niche: f.niche, country: c[0], currency: c[2], timezone: c[3],
        director_name: f.director_name.trim(), director_email: f.director_email.trim(), brief: { request: f.request, staff: f.staff } });
      setDone(r);
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }
  if (done) return (
    <Modal title="Компания создана" onClose={() => onClose(true)}>
      <p>Воронка, KPI, роли, чек-листы аудита и бизнес-ритм ниши уже настроены. Передайте директору доступ — он добавит команду сам.</p>
      <div className="secret">Вход: {location.origin + location.pathname}<br />Почта: {done.email}<br />Временный пароль: {done.temp_password}</div>
      <div className="row" style={{ marginTop: 14 }}>
        <button onClick={() => navigator.clipboard.writeText(`Вход в СИСТЕМУ: ${location.origin + location.pathname}\nПочта: ${done.email}\nВременный пароль: ${done.temp_password}`)}>Скопировать</button>
        <button className="primary" onClick={() => onClose(true)}>Готово</button></div>
    </Modal>
  );
  return (
    <Modal title="Бриф нового клиента" onClose={() => onClose(false)}>
      <Err text={err} />
      <Field label="Компания" htmlFor="bn"><input id="bn" value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
      <div className="grid g2">
        <Field label="Ниша" htmlFor="bniche"><select id="bniche" value={f.niche} onChange={(e) => setF({ ...f, niche: e.target.value })}>{niches.map((n) => <option key={n.key} value={n.key}>{n.title}</option>)}</select></Field>
        <Field label="Страна" htmlFor="bc"><select id="bc" value={f.country} onChange={(e) => setF({ ...f, country: e.target.value })}>{COUNTRIES.map((x) => <option key={x[0]} value={x[0]}>{x[1]} · {x[2]}</option>)}</select></Field>
      </div>
      {f.country === 'RU' && <div className="err">Для клиентов из РФ по 152-ФЗ нужен сервер в РФ. Согласуйте перед продажей.</div>}
      <div className="grid g2">
        <Field label="ФИО директора" htmlFor="bdn"><input id="bdn" value={f.director_name} onChange={(e) => setF({ ...f, director_name: e.target.value })} /></Field>
        <Field label="Почта директора" htmlFor="bde"><input id="bde" type="email" value={f.director_email} onChange={(e) => setF({ ...f, director_email: e.target.value })} /></Field>
      </div>
      <label>Штат (сколько людей по ролям)</label>
      <div className="grid g3">{ROLE_ORDER.filter((r) => r !== 'director').map((r) => <div className="field" key={r}><label>{DEFAULT_ROLE_TITLES[r]}</label>
        <input type="number" min="0" value={f.staff[r]} onChange={(e) => setF({ ...f, staff: { ...f.staff, [r]: Number(e.target.value) } })} /></div>)}</div>
      <Field label="Запрос клиента своими словами" htmlFor="breq"><textarea id="breq" value={f.request} onChange={(e) => setF({ ...f, request: e.target.value })} placeholder="Что болит, что хотят получить" /></Field>
      <button className="primary" disabled={busy} onClick={save}>Создать компанию</button>
    </Modal>
  );
}
