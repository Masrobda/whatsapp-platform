'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ReleveurView from './ReleveurView';
import AgentView from './AgentView';

function parseRole(token: string | null): 'agent_socadel' | 'releveur' {
  const stored = localStorage.getItem('socadel_role');
  if (stored === 'agent_socadel') return 'agent_socadel';
  if (stored === 'releveur') return 'releveur';
  // fallback JWT payload
  try {
    if (!token) return 'releveur';
    const payload = JSON.parse(atob(token.split('.')[1]));
    if (payload.role === 'agent_socadel') return 'agent_socadel';
  } catch (_) {}
  return 'releveur';
}

export default function SocadelDashboardPage() {
  const router = useRouter();
  const [token, setToken] = useState<string | null>(null);
  const [role, setRole] = useState<'agent_socadel' | 'releveur' | null>(null);

  useEffect(() => {
    const t = localStorage.getItem('socadel_token');
    if (!t) {
      router.replace('/socadel/login');
      return;
    }
    setToken(t);
    setRole(parseRole(t));
  }, [router]);

  const logout = () => {
    localStorage.removeItem('socadel_token');
    localStorage.removeItem('socadel_role');
    localStorage.removeItem('socadel_agent');
    router.replace('/socadel/login');
  };

  if (!token || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 text-blue-600">
        Chargement…
      </div>
    );
  }

  return role === 'agent_socadel' ? (
    <AgentView token={token} onLogout={logout} />
  ) : (
    <ReleveurView token={token} onLogout={logout} />
  );
}
