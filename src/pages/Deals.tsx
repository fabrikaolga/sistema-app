import { useEffect, useState } from 'react';
import { supabase, errText, fmtDate, num, addDays, today } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Modal, Err, Field, Pill, PersonSelect } from '../components/ui';

export default function Deals() {
  const { people, company } = useAuth();
  const [stages, setStages] = useState<any[]>([]);
  const [deals, setDeals] = useState<any[]>([]);
  const [owner, setOwner] = useState('');
  const [view, setView] = useState<'open' | 'closed'>('open');
  const [edit, setEdit] = useState<any>(null);
  const [err, setErr] = useState('');

  async function load() {
    const [s, d] = await Promise.all([
      supabase.from('pipeline_stages').select('*').order('ord'),
      supabase.from('deals').select('*').order('next_step_date', { nullsFirst: false }),
    ]);
    if (s.error || d.error) setErr(errText(s.error || d.error)); else { setStages(s.data || []); setDeals(d.data || []); }
  }
  useEffect(() => { load(); }, []);

  const visibleOwners = people.filter((p) => deals.some((d) => d.owner_id === p.id));
  const list = deals.filter((d) => (!owner || d.owner_id === owner) && (view === 'open' ? d.status === 'open' : d.status !== 'open'));
  const name = (id: string) => people.find((p) => p.id === id)?.full_name || '—';
  const daysOn = (d: any) => Math.floor((Date.now() - new Date(d.stage_changed_at).getTime()) / 864e5);

  return (
    <>
      <div className="row between"><div><h1>Сделки</h1><p className="sub">У каждой открытой сделки обязателен следующий шаг с датой</p></div>
        <button className="primary" onClick={() => setEdit({})}>Новая сделка</button></div>
      <Err text={err} />
      <div className="row" style={{ marginBottom: 14 }}>
        <div className="tabs" style={{ margin: 0 }}>
          <button className={view === 'open' ? 'on' : ''} onClick={() => setView('open')}>Воронка</button>
          <button className={view === 'closed' ? 'on' : ''} onClick={() => setView('closed')}>Закрытые</button>
        </div>
        {visibleOwners.length > 1 && <div style={{ width: 260 }}><PersonSelect value={owner} onChange={setOwner} people={visibleOwners} placeholder="Все сотрудники" /></div>}
      </div>
      {view === 'open' ? (
        <div className="kanban">
          {stages.map((s) => {
            const items = list.filter((d) => d.stage_key === s.key);
            const sum = items.reduce((a, d) => a + Number(d.amount), 0);
            return (
              <div className="col" key={s.key}>
                <h3><span>{s.title}</span><span className="muted">{items.length} · {num(sum)}</span></h3>
                {items.map((d) => {
                  const late = d.next_step_date && d.next_step_date < today();
                  const stuck = daysOn(d) > s.max_days;
                  return (
                    <div className="deal" key={d.id} onClick={() => setEdit(d)}>
                      <b>{d.client_name}</b>
                      <div>{num(d.amount)} {company?.currency}</div>
                      <div className="muted small">{name(d.owner_id)}</div>
                      <div className="small" style={{ marginTop: 6, color: late ? 'var(--fail)' : 'var(--muted)' }}>→ {d.next_step} · {fmtDate(d.next_step_date)}</div>
                      {stuck && <span className="pill risk" style={{ marginTop: 6 }}>{daysOn(d)} дн. на этапе</span>}
                    </div>
                  );
                })}
              </div>
            );
          })}
        </div>
      ) : (
        <div className="card"><div className="tbl-wrap"><table>
          <thead><tr><th>Клиент</th><th>Сумма</th><th>Менеджер</th><th>Итог</th><th>Причина отказа</th><th>Обновлено</th></tr></thead>
          <tbody>{list.length === 0 && <tr><td colSpan={6} className="empty">Нет закрытых сделок</td></tr>}
            {list.map((d) => <tr key={d.id} onClick={() => setEdit(d)} style={{ cursor: 'pointer' }}><td>{d.client_name}</td><td>{num(d.amount)}</td><td>{name(d.owner_id)}</td><td><Pill s={d.status} /></td><td className="muted">{d.loss_reason || ''}</td><td>{fmtDate(d.updated_at.slice(0, 10))}</td></tr>)}
          </tbody></table></div></div>
      )}
      {edit && <DealForm deal={edit} stages={stages} onClose={(c) => { setEdit(null); if (c) load(); }} />}
    </>
  );
}

function DealForm({ deal, stages, onClose }: { deal: any; stages: any[]; onClose: (c: boolean) => void }) {
  const { profile, people, company } = useAuth();
  const cfg = company?.config || {};
  const isNew = !deal.id;
  const [f, setF] = useState<any>({
    client_name: '', client_type: '', channel: '', amount: 0, stage_key: stages[0]?.key, next_step: '', next_step_date: addDays(1),
    objections: '', notes: '', owner_id: profile!.id, status: 'open', loss_reason: '', ...deal,
  });
  const [err, setErr] = useState('');
  const [owners, setOwners] = useState(people.filter((p) => p.id === profile!.id));
  useEffect(() => {
    supabase.rpc('subordinates', { p_uid: profile!.id }).then(({ data }) => {
      const ids = new Set<string>((data || []).map((x: any) => x.subordinates ?? x));
      const top = ['director', 'assistant_director'].includes(profile!.role_key);
      setOwners(people.filter((p) => p.is_active && (p.id === profile!.id || ids.has(p.id) || top || p.id === f.owner_id)));
    });
  }, []);
  const set = (k: string, v: any) => setF({ ...f, [k]: v });
  const stage = stages.find((s) => s.key === f.stage_key);

  async function save(status?: string) {
    setErr('');
    const row: any = {
      client_name: f.client_name.trim(), client_type: f.client_type || null, channel: f.channel || null, amount: Number(f.amount) || 0,
      stage_key: f.stage_key, next_step: f.next_step?.trim() || null, next_step_date: f.next_step_date || null,
      objections: f.objections || null, notes: f.notes || null, owner_id: f.owner_id, status: status || f.status, loss_reason: f.loss_reason || null,
    };
    if (!row.client_name) return setErr('Укажите клиента');
    if (row.status === 'lost' && !row.loss_reason) return setErr('Укажите причину отказа');
    if (row.status === 'open' && (!row.next_step || !row.next_step_date)) return setErr('Укажите следующий шаг и дату — без этого сделку сохранить нельзя');
    const q = isNew ? supabase.from('deals').insert(row) : supabase.from('deals').update(row).eq('id', deal.id);
    const { error } = await q;
    if (error) return setErr(errText(error));
    onClose(true);
  }

  return (
    <Modal title={isNew ? 'Новая сделка' : f.client_name} onClose={() => onClose(false)}>
      <Err text={err} />
      <Field label="Клиент" htmlFor="cn"><input id="cn" value={f.client_name} onChange={(e) => set('client_name', e.target.value)} /></Field>
      <div className="grid g2">
        <Field label={`Сумма, ${company?.currency || ''}`} htmlFor="am"><input id="am" type="number" min="0" value={f.amount} onChange={(e) => set('amount', e.target.value)} /></Field>
        <Field label="Этап" htmlFor="st"><select id="st" value={f.stage_key} onChange={(e) => set('stage_key', e.target.value)}>{stages.map((s) => <option key={s.key} value={s.key}>{s.title}</option>)}</select></Field>
      </div>
      {stage?.exit_criteria && <p className="muted small" style={{ marginTop: -6 }}>Условие перехода дальше: {stage.exit_criteria}</p>}
      <div className="grid g2">
        <Field label="Следующий шаг" htmlFor="ns"><input id="ns" value={f.next_step || ''} onChange={(e) => set('next_step', e.target.value)} placeholder="Например: встреча с ЛПР" /></Field>
        <Field label="Дата шага" htmlFor="nd"><input id="nd" type="date" value={f.next_step_date || ''} onChange={(e) => set('next_step_date', e.target.value)} /></Field>
      </div>
      <div className="grid g2">
        <Field label="Тип клиента" htmlFor="ct"><select id="ct" value={f.client_type || ''} onChange={(e) => set('client_type', e.target.value)}><option value="">—</option>{(cfg.client_types || []).map((x: string) => <option key={x}>{x}</option>)}</select></Field>
        <Field label="Канал" htmlFor="ch"><select id="ch" value={f.channel || ''} onChange={(e) => set('channel', e.target.value)}><option value="">—</option>{(cfg.channels || []).map((x: string) => <option key={x}>{x}</option>)}</select></Field>
      </div>
      <Field label="Ответственный"><PersonSelect value={f.owner_id} onChange={(v) => set('owner_id', v)} people={owners} /></Field>
      <Field label="Возражения клиента" htmlFor="ob"><input id="ob" list="objs" value={f.objections || ''} onChange={(e) => set('objections', e.target.value)} />
        <datalist id="objs">{(cfg.objections || []).map((x: string) => <option key={x} value={x} />)}</datalist></Field>
      <Field label="Заметки" htmlFor="nt"><textarea id="nt" value={f.notes || ''} onChange={(e) => set('notes', e.target.value)} /></Field>
      {!isNew && f.status === 'open' && <Field label="Причина отказа (если проиграна)" htmlFor="lr"><select id="lr" value={f.loss_reason || ''} onChange={(e) => set('loss_reason', e.target.value)}><option value="">—</option>{(cfg.loss_reasons || []).map((x: string) => <option key={x}>{x}</option>)}</select></Field>}
      <div className="row">
        <button className="primary" onClick={() => save()}>Сохранить</button>
        {!isNew && f.status === 'open' && <>
          <button onClick={() => save('won')}>Выиграна</button>
          <button className="danger" onClick={() => save('lost')}>Проиграна</button>
        </>}
        {!isNew && f.status !== 'open' && <button onClick={() => save('open')}>Вернуть в работу</button>}
      </div>
    </Modal>
  );
}
