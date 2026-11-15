import { useState } from 'react';
import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from './lib/auth';
import { supabase } from './lib/supabase';
import Login from './pages/Login';
import ChangePassword from './pages/ChangePassword';
import Dashboard from './pages/Dashboard';
import Team from './pages/Team';
import Tasks from './pages/Tasks';
import Deals from './pages/Deals';
import Plans from './pages/Plans';
import Audits from './pages/Audits';
import Rhythm from './pages/Rhythm';
import Log from './pages/Log';
import Admin from './pages/Admin';
import Settings from './pages/Settings';
import Management from './pages/Management';
import Trainer from './pages/Trainer';

function Shell() {
  const { session, profile, company, loading, roleTitle, isManager, isTop } = useAuth();
  const [open, setOpen] = useState(false);
  const loc = useLocation();
  if (loading) return <div className="login"><div className="muted">Загрузка…</div></div>;
  if (!session) return <Login />;
  if (!profile) return <div className="login"><div className="card"><h1>Нет профиля</h1><p className="sub">Аккаунт не привязан к компании. Обратитесь к руководителю.</p><button onClick={() => supabase.auth.signOut()}>Выйти</button></div></div>;
  if (!profile.is_active) return <div className="login"><div className="card"><h1>Доступ закрыт</h1><p className="sub">Ваш аккаунт деактивирован.</p><button onClick={() => supabase.auth.signOut()}>Выйти</button></div></div>;
  if (profile.must_change_password) return <ChangePassword />;

  const links: [string, string, boolean][] = profile.is_superadmin && !profile.company_id
    ? [['/admin', 'Компании клиентов', true]]
    : [
        ['/', 'Главная', true],
        ['/management', 'Регулярный менеджмент', true],
        ['/trainer', 'Тренажёр', true],
        ['/deals', 'Сделки', true],
        ['/tasks', 'Задачи', true],
        ['/plans', 'План / факт', true],
        ['/team', 'Команда', true],
        ['/audits', 'Аудиты', true],
        ['/rhythm', 'Бизнес-ритм', true],
        ['/log', 'Журнал', isTop],
        ['/settings', 'Настройки', isTop],
        ['/admin', 'Компании клиентов', profile.is_superadmin],
      ];

  return (
    <div className="layout">
      <aside className={`side ${open ? 'open' : ''}`} onClick={() => setOpen(false)}>
        <div className="brand">СИСТЕМА</div>
        <div className="brand-sub">{company?.name || 'Fabrika Business AI'}</div>
        <nav className="nav">
          {links.filter((l) => l[2]).map(([to, label]) => <NavLink key={to} to={to} end={to === '/'}>{label}</NavLink>)}
        </nav>
        <div className="me">
          <b>{profile.full_name}</b>
          <span className="muted">{profile.is_superadmin && !profile.company_id ? 'Супер-админ' : roleTitle(profile.role_key)}</span>
          <div style={{ marginTop: 10 }}><button className="small" onClick={() => supabase.auth.signOut()}>Выйти</button></div>
        </div>
      </aside>
      <div>
        <div className="topbar"><button className="small" onClick={() => setOpen(true)} aria-label="Меню">☰</button><b>СИСТЕМА</b></div>
        <main className="main" key={loc.pathname}>
          <Routes>
            {profile.is_superadmin && !profile.company_id ? (
              <><Route path="/admin" element={<Admin />} /><Route path="*" element={<Navigate to="/admin" />} /></>
            ) : (
              <>
                <Route path="/" element={<Dashboard />} />
                <Route path="/management" element={<Management />} />
                <Route path="/trainer" element={<Trainer />} />
                <Route path="/deals" element={<Deals />} />
                <Route path="/tasks" element={<Tasks />} />
                <Route path="/plans" element={<Plans />} />
                <Route path="/team" element={<Team />} />
                <Route path="/audits" element={<Audits />} />
                <Route path="/rhythm" element={<Rhythm />} />
                {isTop && <Route path="/log" element={<Log />} />}
                {isTop && <Route path="/settings" element={<Settings />} />}
                {profile.is_superadmin && <Route path="/admin" element={<Admin />} />}
                <Route path="*" element={<Navigate to="/" />} />
              </>
            )}
          </Routes>
          {!isManager && null}
        </main>
      </div>
    </div>
  );
}

export default function App() {
  return <AuthProvider><HashRouter><Shell /></HashRouter></AuthProvider>;
}
