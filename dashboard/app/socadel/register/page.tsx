'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SocadelRegisterPage() {
  const router = useRouter();
  const [full_name, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [matricule, setMatricule] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOk('');
    if (password !== confirm) {
      setError('Les mots de passe ne correspondent pas');
      return;
    }
    if (password.length < 8) {
      setError('Mot de passe : 8 caractères minimum');
      return;
    }
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/socadel-agent/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, matricule, password, full_name })
      });
      const data = await res.json();
      if (data.success) {
        setOk(data.message || 'Compte créé. Vérifiez votre email.');
        setTimeout(() => router.push('/socadel/activate'), 1500);
      } else {
        setError(data.message || 'Erreur');
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-white px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-blue-100">
        <div className="text-center mb-6">
          <img src="/socad.png" alt="Socadel" className="h-12 mx-auto mb-2" />
          <h1 className="text-xl font-bold text-blue-900">Créer un compte agent</h1>
          <p className="text-xs text-blue-600/80 mt-1">Email @camlight.cm ou @eneo.cm uniquement</p>
        </div>
        <form onSubmit={submit} className="space-y-3">
          <input
            className="w-full border border-blue-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Nom complet"
            value={full_name}
            onChange={(e) => setFullName(e.target.value)}
          />
          <input
            type="email"
            required
            className="w-full border border-blue-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Email professionnel"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
          <input
            required
            className="w-full border border-blue-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Matricule"
            value={matricule}
            onChange={(e) => setMatricule(e.target.value)}
          />
          <input
            type="password"
            required
            className="w-full border border-blue-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Mot de passe (8+ caractères)"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
          <input
            type="password"
            required
            className="w-full border border-blue-200 rounded-xl px-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-blue-500"
            placeholder="Confirmer le mot de passe"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
          />
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          {ok && <p className="text-emerald-700 text-sm bg-emerald-50 rounded-lg px-3 py-2">{ok}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl disabled:bg-blue-400"
          >
            {loading ? 'Création…' : 'Créer mon compte'}
          </button>
        </form>
        <p className="text-center text-sm mt-4">
          <Link href="/socadel/login" className="text-blue-700 hover:underline">
            Déjà un compte ? Se connecter
          </Link>
        </p>
      </div>
    </div>
  );
}
