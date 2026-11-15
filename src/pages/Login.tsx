import { useState } from 'react';
import { supabase, errText } from '../lib/supabase';
import { Err } from '../components/ui';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<'password' | 'link' | 'reset'>('password');
  const [err, setErr] = useState('');
  const [msg, setMsg] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr(''); setMsg(''); setBusy(true);
    try {
      if (mode === 'password') {
        const { error } = await supabase.auth.signInWithPassword({ email: email.trim(), password });
        if (error) throw error;
      } else if (mode === 'link') {
        const { error } = await supabase.auth.signInWithOtp({ email: email.trim(), options: { shouldCreateUser: false, emailRedirectTo: location.origin + location.pathname } });
        if (error) throw error;
        setMsg('Ссылка для входа отправлена на почту.');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), { redirectTo: location.origin + location.pathname });
        if (error) throw error;
        setMsg('Письмо для сброса пароля отправлено.');
      }
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <h1>СИСТЕМА</h1>
        <p className="sub">Управление продажами и командой</p>
        <Err text={err} />
        {msg && <div className="okmsg">{msg}</div>}
        <div className="field"><label htmlFor="email">Почта</label>
          <input id="email" type="email" autoComplete="username" required value={email} onChange={(e) => setEmail(e.target.value)} /></div>
        {mode === 'password' && <div className="field"><label htmlFor="password">Пароль</label>
          <input id="password" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></div>}
        <button className="primary" style={{ width: '100%' }} disabled={busy}>
          {mode === 'password' ? 'Войти' : mode === 'link' ? 'Прислать ссылку' : 'Сбросить пароль'}
        </button>
        <div className="row" style={{ marginTop: 14, fontSize: 13 }}>
          {mode !== 'password' && <a href="#" onClick={(e) => { e.preventDefault(); setMode('password'); }}>Вход по паролю</a>}
          {mode !== 'link' && <a href="#" onClick={(e) => { e.preventDefault(); setMode('link'); }}>Вход по ссылке на почту</a>}
          {mode !== 'reset' && <a href="#" onClick={(e) => { e.preventDefault(); setMode('reset'); }}>Забыли пароль?</a>}
        </div>
      </form>
    </div>
  );
}
