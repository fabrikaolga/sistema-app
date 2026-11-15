import { useEffect, useState } from 'react';

const SEASONS = ['зима', 'зима', 'весна', 'весна', 'весна', 'лето', 'лето', 'лето', 'осень', 'осень', 'осень', 'зима'];
const SOUTH = ['AU', 'NZ', 'AR', 'BR', 'CL', 'ZA', 'UY'];

// Актуальные дата, время и сезон в часовом поясе компании (обновляется каждую минуту)
export function nowInfo(tz?: string, country?: string) {
  const zone = tz || Intl.DateTimeFormat().resolvedOptions().timeZone;
  const d = new Date();
  let m = d.getMonth() + 1, text = '';
  try {
    text = d.toLocaleString('ru-RU', { timeZone: zone, weekday: 'short', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
    m = Number(d.toLocaleString('en-US', { timeZone: zone, month: 'numeric' }));
  } catch { text = d.toLocaleString('ru-RU'); }
  const season = SEASONS[(m - 1 + (SOUTH.includes(country || '') ? 6 : 0)) % 12];
  return { text, season, quarter: Math.ceil(m / 3) };
}

export default function Clock({ tz, country }: { tz?: string; country?: string }) {
  const [i, setI] = useState(() => nowInfo(tz, country));
  useEffect(() => { setI(nowInfo(tz, country)); const t = setInterval(() => setI(nowInfo(tz, country)), 30000); return () => clearInterval(t); }, [tz, country]);
  return <div className="muted small" style={{ margin: '4px 0 10px' }}>{i.text} · {i.season} · {i.quarter} кв.</div>;
}
