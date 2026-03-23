'use client';

import { useState, FormEvent } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginPage() {
  const router = useRouter();
  const [user, setUser] = useState('admin');
  const [pass, setPass] = useState('admin');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      const res = await fetch(`/auth/login`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ user, pass })
      });

      if (res.ok) {
        router.push('/');
      } else {
        const data = await res.json();
        setError(data.error || 'Invalid credentials');
      }
    } catch (err) {
      setError('Connection error. Please check if the backend is running.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-4" style={{ background: '#0c1a2d' }}>
      <div className="max-w-md w-full">
        {/* Brand header */}
        <div className="text-center mb-8">
          <div className="flex items-center justify-center gap-3 mb-3">
            <svg width="48" height="48" viewBox="0 0 44 44" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
              <path fill="#00AEEF" d="M2 2 L14 2 Q22 11 30 2 L42 2 L42 14 Q51 22 42 30 L42 42 L30 42 Q22 51 14 42 L2 42 L2 30 Q-7 22 2 14 Z"/>
              <path fill="none" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" opacity="0.55" d="M13 22 L13 14 L22 14 M22 14 L22 10 M22 14 L22 18 M22 30 L22 34 M22 26 L22 30 M31 22 L31 30 L22 30"/>
              <circle cx="22" cy="22" r="4" fill="white" opacity="0.30"/>
              <circle cx="22" cy="22" r="2" fill="white" opacity="0.55"/>
            </svg>
            <div style={{ textAlign: 'left' }}>
              <div style={{ fontSize: 20, fontWeight: 700, color: '#ffffff', lineHeight: 1.1 }}>Eurocomponentes</div>
              <div style={{ fontSize: 10, fontWeight: 500, color: '#00AEEF', letterSpacing: '0.6px', textTransform: 'uppercase' }}>
                Componentes para veículos industriais
              </div>
            </div>
          </div>
          <p style={{ fontSize: 12.5, color: 'rgba(255,255,255,0.40)', marginTop: 4 }}>
            ProductScout — Portal de pesquisa
          </p>
        </div>

        <div className="bg-white rounded-lg p-8 space-y-5" style={{ boxShadow: '0 8px 32px rgba(0,0,0,.35)', borderRadius: 8 }}>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label htmlFor="username" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                Utilizador
              </label>
              <input
                id="username"
                type="text"
                className="input w-full"
                value={user}
                onChange={(e) => setUser(e.target.value)}
                placeholder="Nome de utilizador"
                required
                disabled={loading}
              />
            </div>

            <div>
              <label htmlFor="password" className="block text-sm font-medium mb-1" style={{ color: 'var(--text-secondary)', fontSize: 11.5, textTransform: 'uppercase', letterSpacing: '0.5px', fontWeight: 600 }}>
                Palavra-passe
              </label>
              <input
                id="password"
                type="password"
                className="input w-full"
                value={pass}
                onChange={(e) => setPass(e.target.value)}
                placeholder="Palavra-passe"
                required
                disabled={loading}
              />
            </div>

            {error && (
              <div className="px-4 py-3 rounded text-sm" style={{ background: 'var(--error-bg)', border: '1px solid var(--error-border)', color: 'var(--error-text)' }}>
                {error}
              </div>
            )}

            <button
              type="submit"
              className="btn btn-primary btn-lg w-full justify-center"
              style={{ width: '100%', justifyContent: 'center' }}
              disabled={loading}
            >
              {loading ? 'A autenticar...' : 'Entrar'}
            </button>
          </form>

          <div className="text-center pt-4 border-t" style={{ borderColor: 'var(--border)', fontSize: 11, color: 'var(--text-muted)' }}>
            ProductScout — Eurocomponentes
          </div>
        </div>
      </div>
    </div>
  );
}
