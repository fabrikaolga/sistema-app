import { useState } from 'react';
import { supabase, errText } from '../lib/supabase';
import { useAuth } from '../lib/auth';
import { Err } from '../components/ui';

export default function ChangePassword() {
  const { profile, reload } = useAuth();
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [agree, setAgree] = useState(false);
  const [err, setErr] = useState('');
  const [busy, setBusy] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault(); setErr('');
    if (p1.length < 10) return setErr('Пароль минимум 10 символов');
    if (!/[0-9]/.test(p1) || !/[A-Za-zА-Яа-я]/.test(p1)) return setErr('Пароль должен содержать буквы и цифры');
    if (p1 !== p2) return setErr('Пароли не совпадают');
    if (!agree) return setErr('Нужно согласие на обработку персональных данных');
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password: p1 });
      if (error) throw error;
      const { error: e2 } = await supabase.from('profiles').update({ must_change_password: false }).eq('id', profile!.id);
      if (e2) throw e2;
      await reload();
    } catch (e) { setErr(errText(e)); } finally { setBusy(false); }
  }

  return (
    <div className="login">
      <form className="card" onSubmit={submit}>
        <h1>Новый пароль</h1>
        <p className="sub">{profile?.full_name}, задайте свой пароль вместо временного.</p>
        <Err text={err} />
        <div className="field"><label htmlFor="p1">Новый пароль</label><input id="p1" type="password" autoComplete="new-password" value={p1} onChange={(e) => setP1(e.target.value)} /></div>
        <div className="field"><label htmlFor="p2">Повторите пароль</label><input id="p2" type="password" autoComplete="new-password" value={p2} onChange={(e) => setP2(e.target.value)} /></div>
        <label className="chk" style={{ fontWeight: 400, color: 'var(--ink)', fontSize: 13 }}>
          <input type="checkbox" checked={agree} onChange={(e) => setAgree(e.target.checked)} />
          <span>Согласен(на) на обработку моих персональных данных работодателем для управления работой в системе.</span>
        </label>
        <button className="primary" style={{ width: '100%', marginTop: 12 }} disabled={busy}>Сохранить</button>
      </form>
    </div>
  );
}
