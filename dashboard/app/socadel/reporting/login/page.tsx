'use client';

import { FormEvent, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SocadelReportingLoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/socadel-reporting/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: email.trim(),
          password,
        }),
      });
      const data = await res.json();

      if (!res.ok || !data.success || !data.token) {
        throw new Error(data.message || 'Identifiants incorrects');
      }

      // Session isolée reporting (ne pas mélanger avec releveur/agent)
      localStorage.setItem('socadel_reporting_token', data.token);
      localStorage.setItem('socadel_reporting_role', 'socadel_reporting');
      if (data.user) {
        localStorage.setItem('socadel_reporting_user', JSON.stringify(data.user));
      }

      // Nettoyer d'éventuels tokens terrain pour éviter les confusions
      // (optionnel — commente si tu veux garder les deux sessions)
      // localStorage.removeItem('socadel_token');

      router.replace('/socadel/live');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur de connexion');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-white px-4">
      <div className="bg-white p-8 sm:p-10 rounded-2xl shadow-xl w-full max-w-md border border-blue-100">
        <div className="text-center mb-8">
          <img src="/socad.png" alt="Socadel" className="h-14 mx-auto mb-3" />
          <h1 className="text-2xl font-bold text-blue-900 tracking-tight">
            Suivi live — Collecte
          </h1>
          <p className="text-sm text-blue-600/80 mt-1">
            Accès reporting Socadel (lecture &amp; export)
          </p>
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <label className="block">
            <span className="text-sm font-medium text-slate-700">E-mail</span>
            <input
              type="email"
              autoComplete="username"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="reporting@socadel.cm"
              className="mt-1 w-full border border-blue-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </label>

          <label className="block">
            <span className="text-sm font-medium text-slate-700">Mot de passe</span>
            <input
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="mt-1 w-full border border-blue-200 rounded-xl px-4 py-3 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
            />
          </label>

          {error && (
            <p className="text-red-600 text-sm bg-red-50 border border-red-100 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-800 disabled:bg-blue-400 text-white font-semibold py-3 rounded-xl transition"
          >
            {loading ? 'Connexion…' : 'Se connecter'}
          </button>
        </form>

        <p className="text-xs text-slate-400 text-center mt-8">
          Compte réservé au pilotage et à l’export — pas de collecte terrain
        </p>
      </div>
    </div>
  );
}
