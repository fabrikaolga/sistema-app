import { createClient } from '@supabase/supabase-js';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
export const SUPABASE_KEY = import.meta.env.VITE_SUPABASE_KEY as string;

export const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: true, autoRefreshToken: true },
});

export type RoleKey = 'director' | 'assistant_director' | 'head_manager' | 'team_lead' | 'seller' | 'assistant';

export const ROLE_ORDER: RoleKey[] = ['director', 'assistant_director', 'head_manager', 'team_lead', 'seller', 'assistant'];

export const DEFAULT_ROLE_TITLES: Record<RoleKey, string> = {
  director: 'Директор',
  assistant_director: 'Ассистент директора',
  head_manager: 'Управляющий',
  team_lead: 'Начальник',
  seller: 'Менеджер',
  assistant: 'Ассистент',
};

export const MANAGER_ROLES: RoleKey[] = ['director', 'assistant_director', 'head_manager', 'team_lead'];

export interface Profile {
  id: string;
  company_id: string | null;
  full_name: string;
  email: string;
  role_key: RoleKey;
  manager_id: string | null;
  is_active: boolean;
  is_superadmin: boolean;
  must_change_password: boolean;
}

export interface Company {
  id: string;
  name: string;
  niche_key: string;
  country: string;
  currency: string;
  timezone: string;
  config: any;
  brief: any;
}

export async function callFn<T = any>(name: string, body: Record<string, any>): Promise<T> {
  const { data, error } = await supabase.functions.invoke(name, { body });
  if (error) {
    let msg = error.message;
    try {
      const ctx: any = (error as any).context;
      if (ctx?.json) { const j = await ctx.json(); msg = j.error || msg; }
    } catch { /* ignore */ }
    throw new Error(msg);
  }
  if ((data as any)?.error) throw new Error((data as any).error);
  return data as T;
}

export function errText(e: any): string {
  const m = e?.message || String(e);
  if (m.includes('open_deal_needs_next_step')) return 'У открытой сделки обязательно должен быть следующий шаг и дата';
  if (m.includes('row-level security')) return 'Нет прав на это действие';
  if (m.includes('Invalid login credentials')) return 'Неверная почта или пароль';
  return m;
}

export const fmtDate = (d: string | null) => (d ? new Date(d + (d.length === 10 ? 'T00:00:00' : '')).toLocaleDateString('ru-RU') : '—');
export const monthStart = (d = new Date()) => new Date(d.getFullYear(), d.getMonth(), 1).toISOString().slice(0, 10);
export const today = () => new Date().toISOString().slice(0, 10);
export const addDays = (n: number) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };
export const num = (v: any) => (v === null || v === undefined ? '—' : Number(v).toLocaleString('ru-RU', { maximumFractionDigits: 1 }));
