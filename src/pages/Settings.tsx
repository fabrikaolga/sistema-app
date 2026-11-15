import { useEffect, useState } from 'react';
import { supabase, errText, ROLE_ORDER } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Err } from '../components/ui';

export default function Settings() {
  const { company, roleTitle, reload } = useAuth();
  const [titles, setTitles] = useState<Record<string, string>>({});
  const [stages, setStages] = useState<any[]>([]);
  const [metrics, setMetrics] = useState<any[]>([]);
  const [err, setErr] = useState(''); const [ok, setOk] = useState('');

  async function load() {
    const [s, m] = await Promise.all([supabase.from('pipeline_stages').select('*').order('ord'), supabase.from('metrics').select('*')]);
    setStages(s.data || []); setMetrics(m.data || []);
    setTitles(Object.fromEntries(ROLE_ORDER.map((r) => [r, roleTitle(r)])));
  }
  useEffect(() => { load(); }, []);

  async function save() {
    setErr(''); setOk('');
    try {
      const cid = company!.id;
      const r1 = await supabase.from('role_titles').upsert(ROLE_ORDER.map((r) => ({ company_id: cid, role_key: r, title: titles[r].trim() || r })));
      if (r1.error) throw r1.error;
      for (const s of stages) {
        const r = await supabase.from('pipeline_stages').update({ title: s.title, max_days: Number(s.max_days), exit_criteria: s.exit_criteria }).eq('id', s.id);
        if (r.error) throw r.error;
      }
      for (const m of metrics) {
        const r = await supabase.from('metrics').update({ title: m.title, is_main: m.is_main, risk_pct: Number(m.risk_pct), fail_pct: Number(m.fail_pct) }).eq('company_id', cid).eq('key', m.key);
        if (r.error) throw r.error;
      }
      await reload(); setOk('Сохранено');
    } catch (e) { setErr(errText(e)); }
  }

  return (
    <>
      <div className="row between"><div><h1>Настройки компании</h1><p className="sub">{company?.name} · ниша: {company?.niche_key}</p></div><button className="primary" onClick={save}>Сохранить всё</button></div>
      <Err text={err} />{ok && <div className="okmsg">{ok}</div>}
      <div className="card"><h2>Названия ролей</h2><div className="grid g3">
        {ROLE_ORDER.map((r) => <div className="field" key={r}><label>{r}</label><input value={titles[r] || ''} onChange={(e) => setTitles({ ...titles, [r]: e.target.value })} /></div>)}
      </div></div>
      <div className="card"><h2>Этапы воронки</h2><div className="tbl-wrap"><table>
        <thead><tr><th>#</th><th>Название</th><th>Норма, дней</th><th>Условие перехода</th></tr></thead>
        <tbody>{stages.map((s, i) => <tr key={s.id}><td>{s.ord}</td>
          <td><input value={s.title} onChange={(e) => setStages(stages.map((x, k) => k === i ? { ...x, title: e.target.value } : x))} /></td>
          <td style={{ width: 110 }}><input type="number" min="1" value={s.max_days} onChange={(e) => setStages(stages.map((x, k) => k === i ? { ...x, max_days: e.target.value } : x))} /></td>
          <td><input value={s.exit_criteria || ''} onChange={(e) => setStages(stages.map((x, k) => k === i ? { ...x, exit_criteria: e.target.value } : x))} /></td></tr>)}</tbody>
      </table></div></div>
      <div className="card"><h2>Показатели (KPI)</h2><div className="tbl-wrap"><table>
        <thead><tr><th>Название</th><th>Главный</th><th>Риск, % от нормы</th><th>Провал, % от нормы</th></tr></thead>
        <tbody>{metrics.map((m, i) => <tr key={m.key}>
          <td><input value={m.title} onChange={(e) => setMetrics(metrics.map((x, k) => k === i ? { ...x, title: e.target.value } : x))} /></td>
          <td><input type="radio" name="main" style={{ width: 'auto' }} checked={m.is_main} onChange={() => setMetrics(metrics.map((x, k) => ({ ...x, is_main: k === i })))} /></td>
          <td style={{ width: 130 }}><input type="number" value={m.risk_pct} onChange={(e) => setMetrics(metrics.map((x, k) => k === i ? { ...x, risk_pct: e.target.value } : x))} /></td>
          <td style={{ width: 130 }}><input type="number" value={m.fail_pct} onChange={(e) => setMetrics(metrics.map((x, k) => k === i ? { ...x, fail_pct: e.target.value } : x))} /></td></tr>)}</tbody>
      </table></div><p className="muted small">«Риск» — выполнение ниже этого процента от нормы на сегодня, «Провал» — ниже второго порога.</p></div>
    </>
  );
}
