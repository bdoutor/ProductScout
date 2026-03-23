'use client';

import React, { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';


export default function AuthHeader() {
  const pathname = usePathname();
  const router = useRouter();
  const [role, setRole] = useState<string | null>(null);

  useEffect(() => {
    fetch('/auth/me', { credentials: 'include' })
      .then((r) => r.json())
      .then((d) => setRole(d.role || 'user'))
      .catch(() => setRole('user'));
  }, []);

  const isConfig = pathname?.startsWith('/admin');
  const isAdmin = role === 'admin';

  async function handleLogout() {
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    router.push('/login');
  }

  return (
    <header
      style={{
        background: '#0c1a2d',
        borderBottom: '1px solid #1a3347',
        position: 'sticky',
        top: 0,
        zIndex: 100,
      }}
    >
      <div
        style={{
          maxWidth: 1280,
          margin: '0 auto',
          padding: '0 32px',
          height: 60,
          display: 'flex',
          alignItems: 'center',
          gap: 0,
        }}
      >
        {/* ── Brand ─────────────────────────────────────────────────────── */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span
              style={{
                fontSize: 15,
                fontWeight: 700,
                color: '#ffffff',
                letterSpacing: '-0.2px',
                lineHeight: 1.1,
              }}
            >
              Eurocomponentes
            </span>
            <span
              style={{
                fontSize: 9,
                fontWeight: 500,
                color: '#00AEEF',
                letterSpacing: '0.7px',
                textTransform: 'uppercase',
              }}
            >
              Componentes para veículos industriais
            </span>
          </div>
        </div>

        {/* ── Divider ───────────────────────────────────────────────────── */}
        <div
          style={{
            width: 1,
            height: 28,
            background: 'rgba(255,255,255,0.12)',
            margin: '0 16px',
            flexShrink: 0,
          }}
        />

        {/* ── Module label + nav tabs ───────────────────────────────────── */}
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 600,
            color: 'rgba(255,255,255,0.50)',
            letterSpacing: 0.2,
            flexShrink: 0,
            marginRight: 12,
          }}
        >
          ProductScout
        </span>

        <nav style={{ display: 'flex', alignItems: 'center', height: 60 }}>
          <button
            onClick={() => router.push('/')}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              padding: '0 14px',
              height: 60,
              fontSize: 12.5,
              fontWeight: 500,
              color: !isConfig ? '#ffffff' : 'rgba(255,255,255,0.48)',
              borderBottom: !isConfig ? '2px solid #00AEEF' : '2px solid transparent',
              borderTop: 'none',
              borderLeft: 'none',
              borderRight: 'none',
              background: 'none',
              cursor: 'pointer',
              transition: 'color .15s, border-color .15s',
              fontFamily: 'inherit',
            }}
          >
            <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.2} aria-hidden="true">
              <circle cx="11" cy="11" r="8" />
              <path d="M21 21l-4.35-4.35" />
            </svg>
            Pesquisa
          </button>

          {isAdmin && (
            <button
              onClick={() => router.push('/admin')}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                padding: '0 14px',
                height: 60,
                fontSize: 12.5,
                fontWeight: 500,
                color: isConfig ? '#ffffff' : 'rgba(255,255,255,0.48)',
                borderBottom: isConfig ? '2px solid #00AEEF' : '2px solid transparent',
                borderTop: 'none',
                borderLeft: 'none',
                borderRight: 'none',
                background: 'none',
                cursor: 'pointer',
                transition: 'color .15s, border-color .15s',
                fontFamily: 'inherit',
              }}
            >
              <svg width="13" height="13" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true">
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z" />
              </svg>
              Configuração
            </button>
          )}
        </nav>

        {/* ── Logout ────────────────────────────────────────────────────── */}
        <div style={{ marginLeft: 'auto' }}>
          <button
            onClick={handleLogout}
            style={{
              padding: '6px 14px',
              fontSize: 12,
              fontWeight: 500,
              color: 'rgba(255,255,255,0.60)',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.11)',
              borderRadius: 4,
              cursor: 'pointer',
              transition: 'background .15s, color .15s',
              fontFamily: 'inherit',
            }}
            onMouseEnter={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.12)';
              (e.currentTarget as HTMLButtonElement).style.color = '#fff';
            }}
            onMouseLeave={(e) => {
              (e.currentTarget as HTMLButtonElement).style.background = 'rgba(255,255,255,0.06)';
              (e.currentTarget as HTMLButtonElement).style.color = 'rgba(255,255,255,0.60)';
            }}
          >
            Terminar sessão
          </button>
        </div>
      </div>
    </header>
  );
}
