import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase, DEFAULT_ROLE_TITLES, MANAGER_ROLES, type Company, type Profile, type RoleKey } from './supabase';

interface Ctx {
  session: Session | null;
  profile: Profile | null;
  company: Company | null;
  roleTitles: Record<string, string>;
  people: Profile[];
  loading: boolean;
  reload: () => Promise<void>;
  roleTitle: (k: RoleKey) => string;
  isManager: boolean;
  isTop: boolean;
}

const AuthCtx = createContext<Ctx>(null as any);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [roleTitles, setRoleTitles] = useState<Record<string, string>>({});
  const [people, setPeople] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);

  async function load(s: Session | null) {
    if (!s) { setProfile(null); setCompany(null); setPeople([]); setLoading(false); return; }
    const { data: p } = await supabase.from('profiles').select('*').eq('id', s.user.id).maybeSingle();
    setProfile(p as Profile | null);
    if (p?.company_id) {
      const [{ data: c }, { data: rt }, { data: ppl }] = await Promise.all([
        supabase.from('companies').select('*').eq('id', p.company_id).maybeSingle(),
        supabase.from('role_titles').select('*').eq('company_id', p.company_id),
        supabase.from('profiles').select('*').eq('company_id', p.company_id).order('full_name'),
      ]);
      setCompany(c as Company | null);
      setRoleTitles(Object.fromEntries((rt || []).map((r: any) => [r.role_key, r.title])));
      setPeople((ppl || []) as Profile[]);
    } else { setCompany(null); setPeople([]); }
    setLoading(false);
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); load(data.session); });
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); load(s); });
    return () => sub.subscription.unsubscribe();
  }, []);

  const roleTitle = (k: RoleKey) => roleTitles[k] || DEFAULT_ROLE_TITLES[k] || k;
  const isManager = !!profile && MANAGER_ROLES.includes(profile.role_key);
  const isTop = !!profile && ['director', 'assistant_director'].includes(profile.role_key);

  return (
    <AuthCtx.Provider value={{ session, profile, company, roleTitles, people, loading, reload: () => load(session), roleTitle, isManager, isTop }}>
      {children}
    </AuthCtx.Provider>
  );
}
