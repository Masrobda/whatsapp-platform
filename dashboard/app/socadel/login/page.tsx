'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { setSocadelSession, apiUrl } from '../../lib/socadel-auth';

type TabId = 'releveur' | 'agent';
type ReleveurMode = 'login' | 'register' | 'forgot' | 'reset';
type AgentStep = 'login' | 'register' | 'activate' | 'forgot' | 'reset';

const TABS: { id: TabId; label: string }[] = [
  { id: 'releveur', label: 'Releveur' },
  { id: 'agent', label: 'Agent Socadel' },
];

const ENTREPRISES = [
  'ACTIVE RH+', 'EUROPE AFRIQUE', 'MGS', 'RED BRICK', 'SOKAMTE',
  'EMPLOIS SERVICES', 'CIBLES ENERGIES', 'AWUDOU INDUSTRY SARL',
  'CBD', 'EROMAT 3I', 'JN COMPANY', 'SOGIN',
];

const ROLES = ['RELEVEUR', 'DISTRIBUTEUR', 'COUPEUR', 'ELECTRICIEN', 'COMMERCIAL', 'CHARGE FACTURATION'];

export default function SocadelLoginPage() {
  const router = useRouter();
  const [tab, setTab] = useState<TabId>('releveur');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [info, setInfo] = useState('');
  const [mode, setMode] = useState<ReleveurMode>('login');

  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [entreprise, setEntreprise] = useState(ENTREPRISES[0]);
  const [terrainRole, setTerrainRole] = useState(ROLES[0]);

  const [email, setEmail] = useState('');
  const [matricule, setMatricule] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [agentStep, setAgentStep] = useState<AgentStep>('login');

  const clearMsgs = () => { setError(''); setInfo(''); };

  async function handleReleveurLogin(e: FormEvent) {
    e.preventDefault();
    clearMsgs(); setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/auth/socadel-releveur/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Connexion impossible');
      setSocadelSession({ token: data.token, user: { role: 'releveur', ...data.releveur } });
      router.push('/socadel/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally { setLoading(false); }
  }

  async function handleReleveurRegister(e: FormEvent) {
    e.preventDefault();
    clearMsgs(); setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/auth/socadel-releveur/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, full_name: fullName, entreprise, role: terrainRole, password }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Inscription impossible');
      setMode('login');
      setInfo(data.message || 'Compte créé. Connectez-vous.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally { setLoading(false); }
  }

  // ── Mot de passe oublié — Releveur ──
  async function handleReleveurForgot(e: FormEvent) {
    e.preventDefault();
    clearMsgs(); setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/auth/socadel-releveur/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur');
      setInfo('Si un compte existe, un code a été envoyé sur WhatsApp. Il est valable 15 minutes.');
      setMode('reset');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally { setLoading(false); }
  }

  async function handleReleveurReset(e: FormEvent) {
    e.preventDefault();
    clearMsgs(); setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/auth/socadel-releveur/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone, code, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur');
      setMode('login');
      setCode(''); setNewPassword('');
      setInfo('Mot de passe mis à jour. Connectez-vous.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally { setLoading(false); }
  }

  // ── Mot de passe oublié — Agent ──
  async function handleAgentForgot(e: FormEvent) {
    e.preventDefault();
    clearMsgs(); setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/auth/socadel-agent/forgot-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur');
      setInfo('Si un compte existe, un code a été envoyé par email. Il est valable 15 minutes.');
      setAgentStep('reset');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally { setLoading(false); }
  }

  async function handleAgentReset(e: FormEvent) {
    e.preventDefault();
    clearMsgs(); setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/auth/socadel-agent/reset-password'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code, new_password: newPassword }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Erreur');
      setAgentStep('login');
      setCode(''); setNewPassword('');
      setInfo('Mot de passe mis à jour. Connectez-vous.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally { setLoading(false); }
  }

  async function handleAgentLogin(e: FormEvent) {
    e.preventDefault();
    clearMsgs(); setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/auth/socadel-agent/login'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        if (data.code === 'NOT_ACTIVATED') setAgentStep('activate');
        throw new Error(data.message || 'Connexion impossible');
      }
      setSocadelSession({ token: data.token, user: { role: 'agent_socadel', ...data.agent } });
      router.push('/socadel/dashboard');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally { setLoading(false); }
  }

  async function handleAgentRegister(e: FormEvent) {
    e.preventDefault();
    clearMsgs(); setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/auth/socadel-agent/register'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, matricule, password, full_name: fullName }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Inscription impossible');
      setAgentStep('activate');
      setInfo(data.message);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally { setLoading(false); }
  }

  async function handleAgentActivate(e: FormEvent) {
    e.preventDefault();
    clearMsgs(); setLoading(true);
    try {
      const res = await fetch(apiUrl('/api/v1/auth/socadel-agent/activate'), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, code }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message || 'Activation impossible');
      setAgentStep('login');
      setInfo('Compte activé. Connectez-vous.');
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Erreur');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-white flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl border border-blue-100 overflow-hidden">
        <div className="bg-blue-800 text-white px-6 py-5 text-center">
          <img src="/socad.png" alt="Socadel" className="h-12 mx-auto mb-2" />
          <h1 className="text-xl font-semibold">Socadel Collecte</h1>
          <p className="text-sm text-blue-100 mt-1">Facture digitale WhatsApp</p>
        </div>

        <div className="flex border-b border-slate-200">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              onClick={() => {
                setTab(t.id);
                clearMsgs();
                setMode('login');
                setAgentStep('login');
              }}
              className={`flex-1 py-3 text-sm font-medium ${
                tab === t.id
                  ? 'text-blue-800 border-b-2 border-blue-700 bg-blue-50/50'
                  : 'text-slate-500'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="p-6">
          {error && (
            <div className="mb-4 rounded-lg bg-red-50 text-red-700 text-sm px-3 py-2 border border-red-100">
              {error}
            </div>
          )}
          {info && (
            <div className="mb-4 rounded-lg bg-emerald-50 text-emerald-700 text-sm px-3 py-2 border border-emerald-100">
              {info}
            </div>
          )}

          {/* ─── RELEVEUR — LOGIN ─── */}
          {tab === 'releveur' && mode === 'login' && (
            <form onSubmit={handleReleveurLogin} className="space-y-4">
              <Field label="Téléphone" value={phone} onChange={setPhone} placeholder="+2376XXXXXXXX" inputMode="tel" />
              <Field label="Mot de passe" type="password" value={password} onChange={setPassword} />
              <Btn loading={loading}>Se connecter</Btn>
              <div className="text-center text-sm text-slate-500 space-y-1">
                <p>
                  Pas de compte ?{' '}
                  <button type="button" className="text-blue-700 font-medium" onClick={() => { clearMsgs(); setMode('register'); }}>
                    Créer un compte
                  </button>
                </p>
                <button type="button" className="text-slate-500 text-xs underline" onClick={() => { clearMsgs(); setMode('forgot'); }}>
                  Mot de passe oublié ?
                </button>
              </div>
            </form>
          )}

          {/* ─── RELEVEUR — REGISTER ─── */}
          {tab === 'releveur' && mode === 'register' && (
            <form onSubmit={handleReleveurRegister} className="space-y-4">
              <Field label="Nom complet" value={fullName} onChange={setFullName} required />
              <Select label="Entreprise" value={entreprise} onChange={setEntreprise} options={ENTREPRISES} required />
              <Select label="Rôle" value={terrainRole} onChange={setTerrainRole} options={ROLES} required />
              <Field label="Téléphone" value={phone} onChange={setPhone} placeholder="+2376XXXXXXXX" inputMode="tel" required />
              <Field label="Mot de passe (8 car. min.)" type="password" value={password} onChange={setPassword} required />
              <Btn loading={loading}>Créer mon compte</Btn>
              <p className="text-center text-sm text-slate-500">
                <button type="button" className="text-blue-700" onClick={() => { clearMsgs(); setMode('login'); }}>
                  Déjà un compte ? Connexion
                </button>
              </p>
            </form>
          )}

          {/* ─── RELEVEUR — FORGOT ─── */}
          {tab === 'releveur' && mode === 'forgot' && (
            <form onSubmit={handleReleveurForgot} className="space-y-4">
              <p className="text-sm text-slate-600">
                Entrez votre numéro WhatsApp. Un code à 6 chiffres vous sera envoyé.
              </p>
              <Field label="Téléphone" value={phone} onChange={setPhone} placeholder="+2376XXXXXXXX" inputMode="tel" required />
              <Btn loading={loading}>Recevoir le code</Btn>
              <p className="text-center text-sm">
                <button type="button" className="text-blue-700" onClick={() => { clearMsgs(); setMode('login'); }}>
                  Retour connexion
                </button>
              </p>
            </form>
          )}

          {/* ─── RELEVEUR — RESET ─── */}
          {tab === 'releveur' && mode === 'reset' && (
            <form onSubmit={handleReleveurReset} className="space-y-4">
              <p className="text-sm text-slate-600">
                Saisissez le code reçu et votre nouveau mot de passe.
              </p>
              <Field label="Code (6 chiffres)" value={code} onChange={setCode} inputMode="numeric" required />
              <Field label="Nouveau mot de passe (8 car. min.)" type="password" value={newPassword} onChange={setNewPassword} required />
              <Btn loading={loading}>Réinitialiser</Btn>
              <p className="text-center text-sm">
                <button type="button" className="text-blue-700" onClick={() => { clearMsgs(); setMode('forgot'); }}>
                  Renvoyer le code
                </button>
              </p>
            </form>
          )}

          {/* ─── AGENT — LOGIN ─── */}
          {tab === 'agent' && agentStep === 'login' && (
            <form onSubmit={handleAgentLogin} className="space-y-4">
              <Field label="Email Socadel" type="email" value={email} onChange={setEmail} placeholder="prenom@camlight.cm" />
              <Field label="Mot de passe" type="password" value={password} onChange={setPassword} />
              <Btn loading={loading}>Se connecter</Btn>
              <p className="text-center text-sm text-slate-500 space-y-1">
                <button type="button" className="text-blue-700 block w-full" onClick={() => { clearMsgs(); setAgentStep('register'); }}>
                  Créer un compte agent
                </button>
                <button type="button" className="text-slate-500 text-xs block w-full" onClick={() => { clearMsgs(); setAgentStep('activate'); }}>
                  Activer avec le code email
                </button>
                <button type="button" className="text-slate-500 text-xs underline block w-full" onClick={() => { clearMsgs(); setAgentStep('forgot'); }}>
                  Mot de passe oublié ?
                </button>
              </p>
            </form>
          )}

          {/* ─── AGENT — REGISTER ─── */}
          {tab === 'agent' && agentStep === 'register' && (
            <form onSubmit={handleAgentRegister} className="space-y-4">
              <Field label="Nom complet" value={fullName} onChange={setFullName} />
              <Field label="Matricule" value={matricule} onChange={setMatricule} required />
              <Field label="Email (@camlight.cm ou @eneo.cm)" type="email" value={email} onChange={setEmail} required />
              <Field label="Mot de passe" type="password" value={password} onChange={setPassword} required />
              <Btn loading={loading}>S’inscrire</Btn>
              <p className="text-center text-sm">
                <button type="button" className="text-blue-700" onClick={() => { clearMsgs(); setAgentStep('login'); }}>
                  Retour connexion
                </button>
              </p>
            </form>
          )}

          {/* ─── AGENT — ACTIVATE ─── */}
          {tab === 'agent' && agentStep === 'activate' && (
            <form onSubmit={handleAgentActivate} className="space-y-4">
              <p className="text-sm text-slate-600">Code reçu par email Socadel.</p>
              <Field label="Email" type="email" value={email} onChange={setEmail} />
              <Field label="Code d’activation" value={code} onChange={setCode} inputMode="numeric" />
              <Btn loading={loading}>Activer le compte</Btn>
              <p className="text-center text-sm">
                <button type="button" className="text-blue-700" onClick={() => { clearMsgs(); setAgentStep('login'); }}>
                  Retour connexion
                </button>
              </p>
            </form>
          )}

          {/* ─── AGENT — FORGOT ─── */}
          {tab === 'agent' && agentStep === 'forgot' && (
            <form onSubmit={handleAgentForgot} className="space-y-4">
              <p className="text-sm text-slate-600">
                Entrez votre email Socadel. Un code à 6 chiffres vous sera envoyé.
              </p>
              <Field label="Email" type="email" value={email} onChange={setEmail} required />
              <Btn loading={loading}>Recevoir le code</Btn>
              <p className="text-center text-sm">
                <button type="button" className="text-blue-700" onClick={() => { clearMsgs(); setAgentStep('login'); }}>
                  Retour connexion
                </button>
              </p>
            </form>
          )}

          {/* ─── AGENT — RESET ─── */}
          {tab === 'agent' && agentStep === 'reset' && (
            <form onSubmit={handleAgentReset} className="space-y-4">
              <p className="text-sm text-slate-600">
                Saisissez le code reçu par email et votre nouveau mot de passe.
              </p>
              <Field label="Email" type="email" value={email} onChange={setEmail} required />
              <Field label="Code (6 chiffres)" value={code} onChange={setCode} inputMode="numeric" required />
              <Field label="Nouveau mot de passe (8 car. min.)" type="password" value={newPassword} onChange={setNewPassword} required />
              <Btn loading={loading}>Réinitialiser</Btn>
              <p className="text-center text-sm">
                <button type="button" className="text-blue-700" onClick={() => { clearMsgs(); setAgentStep('forgot'); }}>
                  Renvoyer le code
                </button>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

/* ─── Composants utilitaires ─── */
function Field({ label, value, onChange, type = 'text', placeholder, inputMode, required }: {
  label: string; value: string; onChange: (v: string) => void; type?: string;
  placeholder?: string; inputMode?: React.HTMLAttributes<HTMLInputElement>['inputMode']; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type={type} value={value} onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder} inputMode={inputMode} required={required}
        className="mt-1 w-full rounded-xl border border-blue-200 px-3 py-2.5 text-base focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </label>
  );
}

function Select({ label, value, onChange, options, required }: {
  label: string; value: string; onChange: (v: string) => void; options: string[]; required?: boolean;
}) {
  return (
    <label className="block">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <select
        value={value} onChange={(e) => onChange(e.target.value)} required={required}
        className="mt-1 w-full rounded-xl border border-blue-200 px-3 py-2.5 text-base bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
      >
        {options.map((opt) => <option key={opt} value={opt}>{opt}</option>)}
      </select>
    </label>
  );
}

function Btn({ children, loading }: { children: React.ReactNode; loading: boolean }) {
  return (
    <button
      type="submit" disabled={loading}
      className="w-full rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold py-3 disabled:opacity-60"
    >
      {loading ? 'Patientez…' : children}
    </button>
  );
}
