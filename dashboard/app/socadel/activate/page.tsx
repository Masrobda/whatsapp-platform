'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';

export default function SocadelActivatePage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [ok, setOk] = useState('');
  const [loading, setLoading] = useState(false);

  const activate = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setOk('');
    setLoading(true);
    try {
      const res = await fetch('/api/v1/auth/socadel-agent/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code })
      });
      const data = await res.json();
      if (data.success) {
        setOk('Compte activé. Vous pouvez vous connecter.');
        setTimeout(() => router.push('/socadel/login'), 1200);
      } else {
        setError(data.message || 'Code invalide');
      }
    } catch {
      setError('Erreur réseau');
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError('');
    setOk('');
    if (!email) {
      setError('Saisissez votre email');
      return;
    }
    try {
      const res = await fetch('/api/v1/auth/socadel-agent/resend-code', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email })
      });
      const data = await res.json();
      setOk(data.message || 'Code renvoyé si le compte existe');
    } catch {
      setError('Erreur réseau');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-slate-50 via-blue-50 to-white px-4">
      <div className="bg-white p-8 rounded-2xl shadow-xl w-full max-w-md border border-blue-100">
        <div className="text-center mb-6">
          <img src="/socad.png" alt="Socadel" className="h-12 mx-auto mb-2" />
          <h1 className="text-xl font-bold text-blue-900">Activer mon compte</h1>
          <p className="text-xs text-slate-500 mt-1">Code à 6 chiffres reçu par email</p>
        </div>
        <form onSubmit={activate} className="space-y-3">
          <input
            type="email"
            required
            placeholder="Email professionnel"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border border-blue-200 rounded-xl px-4 py-2.5 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <input
            required
            placeholder="Code d'activation"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="w-full border border-blue-200 rounded-xl px-4 py-2.5 text-sm tracking-widest text-center font-mono focus:ring-2 focus:ring-blue-500 outline-none"
            maxLength={6}
          />
          {error && <p className="text-red-600 text-sm bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          {ok && <p className="text-emerald-700 text-sm bg-emerald-50 rounded-lg px-3 py-2">{ok}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 rounded-xl disabled:bg-blue-400"
          >
            {loading ? 'Activation…' : 'Activer'}
          </button>
          <button
            type="button"
            onClick={resend}
            className="w-full text-sm text-blue-700 hover:underline py-1"
          >
            Renvoyer le code
          </button>
        </form>
        <p className="text-center text-sm mt-4">
          <Link href="/socadel/login" className="text-blue-700 hover:underline">
            Retour connexion
          </Link>
        </p>
      </div>
    </div>
  );
}
