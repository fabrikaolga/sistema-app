import { useState } from 'react';
import { callFn, errText } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Err } from '../components/ui';

const SCENARIOS = [
  'Холодный звонок: клиент занят и не хочет говорить',
  'Клиент говорит «дорого», сравнивает с конкурентом',
  'Клиент «подумаю» после получения КП',
  'Клиент уже работает с другим поставщиком и доволен',
  'Руководитель ↔ подчинённый: разговор о провале плана 2 недели подряд',
  'Руководитель ↔ подчинённый: опытный сотрудник нарушает модель работы',
];

// Тренажёр: AI играет клиента (или подчинённого), затем оценивает по 7 этапам продаж
export default function Trainer() {
  const { company } = useAuth();
  const [scenario, setScenario] = useState(SCENARIOS[1]);
  const [history, setHistory] = useState<{ role: 'user' | 'assistant'; content: string }[]>([]);
  const [input, setInput] = useState(''); const [busy, setBusy] = useState(false); const [err, setErr] = useState('');
  const [score, setScore] = useState('');
  const full = `${scenario}. Ниша: ${company?.niche_key || 'малый бизнес'}.`;
  async function send() {
    if (!input.trim()) return;
    const h = [...history, { role: 'user' as const, content: input.trim() }];
    setHistory(h); setInput(''); setBusy(true); setErr('');
    try { const r = await callFn<{ text: string }>('ai-coach', { action: 'roleplay', scenario: full, history: h }); setHistory([...h, { role: 'assistant', content: r.text }]); }
    catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }
  async function finish() {
    setBusy(true); setErr('');
    try { const r = await callFn<{ text: string }>('ai-coach', { action: 'roleplay_score', history }); setScore(r.text); }
    catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }
  return (
    <>
      <h1>Тренажёр</h1>
      <p className="sub">AI играет клиента или подчинённого. В конце — оценка по 7 этапам продаж и разбор ошибок.</p>
      <div className="card">
        <div className="row"><select style={{ maxWidth: 520 }} value={scenario} onChange={(e) => { setScenario(e.target.value); setHistory([]); setScore(''); }}>{SCENARIOS.map((s) => <option key={s}>{s}</option>)}</select>
          <button onClick={() => { setHistory([]); setScore(''); }}>Сначала</button></div>
      </div>
      <Err text={err} />
      <div className="card">
        {history.length === 0 && <div className="empty">Начните разговор первой репликой.</div>}
        {history.map((m, i) => <div key={i} className="reco" style={{ borderLeftColor: m.role === 'user' ? 'var(--accent)' : 'var(--risk)' }}><b>{m.role === 'user' ? 'Вы' : 'Клиент'}</b><p style={{ color: 'var(--ink)' }}>{m.content}</p></div>)}
        <div className="row" style={{ marginTop: 10 }}>
          <input value={input} onChange={(e) => setInput(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && send()} placeholder="Ваша реплика" style={{ flex: 1 }} />
          <button className="primary" disabled={busy} onClick={send}>Сказать</button>
          <button disabled={busy || history.length < 4} onClick={finish}>Оценить</button>
        </div>
      </div>
      {score && <div className="card"><h2>Оценка</h2><div style={{ whiteSpace: 'pre-wrap' }}>{score}</div></div>}
    </>
  );
}
