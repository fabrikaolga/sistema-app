import { useState } from 'react';
import { useAuth } from '../lib/auth';
import { CreateTask } from './Tasks';

export default function Rhythm() {
  const { company, roleTitle, isManager } = useAuth();
  const rituals: any[] = company?.config?.rituals || [];
  const [task, setTask] = useState<any>(null);
  return (
    <>
      <h1>Бизнес-ритм</h1>
      <p className="sub">Регулярные встречи компании. Решения со встречи сразу ставьте задачами — они попадут в контроль.</p>
      <div className="grid g2">
        {rituals.map((r, i) => (
          <div className="card" key={i}>
            <div className="row between"><h2 style={{ margin: 0 }}>{r.name}</h2><span className="pill info">{r.when}</span></div>
            <p className="muted small">Ведёт: {roleTitle(r.owner_role)} · {r.duration}</p>
            <ol className="small">{(r.agenda || []).map((a: string, k: number) => <li key={k}>{a}</li>)}</ol>
            {isManager && <button className="small" onClick={() => setTask({ source: 'meeting', title: '', expected_result: '' })}>Решение → задача</button>}
          </div>
        ))}
      </div>
      {task && <CreateTask preset={task} onClose={() => setTask(null)} />}
    </>
  );
}
