'use client';

import { useEffect, useState } from 'react';
import { getUsers, createUser, updateUser, AppUser } from '@/utils/api';

interface SupplierCredential {
  id: string;
  name: string;
  login: string;
  has_password: boolean;
  url: string;
  notes?: string;
  active: boolean;
}

// ── Shared tab pill style helpers ─────────────────────────────────────────

function tabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '7px 18px',
    fontSize: 13,
    fontWeight: 500,
    borderRadius: 4,
    border: 'none',
    cursor: 'pointer',
    fontFamily: 'inherit',
    background: active ? '#00AEEF' : 'transparent',
    color: active ? '#fff' : '#6b7280',
    transition: 'background .15s, color .15s',
  };
}

// ── Suppliers tab ─────────────────────────────────────────────────────────

function SuppliersTab() {
  const [credentials, setCredentials] = useState<SupplierCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadCredentials() {
    setLoading(true);
    try {
      const res = await fetch('/admin/supplier-creds', { credentials: 'include' });
      if (res.ok) setCredentials(await res.json());
    } catch {}
    finally { setLoading(false); }
  }

  useEffect(() => { loadCredentials(); }, []);

  async function handleSave(cred: Partial<SupplierCredential>) {
    try {
      const method = cred.id ? 'PUT' : 'POST';
      const url = cred.id ? `/admin/supplier-creds/${cred.id}` : '/admin/supplier-creds';
      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(cred),
      });
      if (res.ok) { await loadCredentials(); setEditingId(null); }
      else { const d = await res.json(); alert(`Erro: ${d.error}`); }
    } catch { alert('Falha ao guardar'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Eliminar este fornecedor?')) return;
    try {
      const res = await fetch(`/admin/supplier-creds/${id}`, { method: 'DELETE', credentials: 'include' });
      if (res.ok) await loadCredentials();
      else alert('Falha ao eliminar');
    } catch { alert('Falha ao eliminar'); }
  }

  function handleAddNew() {
    const newCred: SupplierCredential = { id: 'new', name: '', login: '', has_password: false, url: '', notes: '', active: true };
    setCredentials([newCred, ...credentials]);
    setEditingId('new');
  }

  function handleCancelNew() {
    setCredentials(credentials.filter(c => c.id !== 'new'));
    setEditingId(null);
  }

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {credentials.length} fornecedor{credentials.length !== 1 ? 'es' : ''}
        </span>
        <button
          onClick={handleAddNew}
          disabled={editingId !== null}
          style={{
            padding: '7px 16px', fontSize: 13, fontWeight: 500,
            background: editingId !== null ? '#d1d5db' : '#00AEEF',
            color: '#fff', border: 'none', borderRadius: 4, cursor: editingId !== null ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + Adicionar fornecedor
        </button>
      </div>

      <div style={{ background: '#fff', borderRadius: 6, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>A carregar...</div>
        ) : credentials.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            Nenhum fornecedor encontrado.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
              <thead>
                <tr style={{ background: '#f5f6f7', borderBottom: '1px solid #e5e7eb' }}>
                  {['Nome', 'Login', 'Password', 'URL', 'Notas', 'Activo', 'Acções'].map(h => (
                    <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#374151' }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {credentials.map(cred => (
                  <SupplierRow
                    key={cred.id}
                    credential={cred}
                    isEditing={editingId === cred.id}
                    onEdit={() => setEditingId(cred.id)}
                    onSave={handleSave}
                    onCancel={() => cred.id === 'new' ? handleCancelNew() : setEditingId(null)}
                    onDelete={handleDelete}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

interface SupplierRowProps {
  credential: SupplierCredential;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (cred: Partial<SupplierCredential>) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}

function SupplierRow({ credential, isEditing, onEdit, onSave, onCancel, onDelete }: SupplierRowProps) {
  const [formData, setFormData] = useState<any>(credential);

  useEffect(() => { setFormData(credential); }, [credential]);

  function handleSubmit() {
    if (!formData.name || !formData.login || (credential.id === 'new' && !formData.password) || !formData.url) {
      alert('Preencha todos os campos obrigatórios (Nome, Login, Password, URL)');
      return;
    }
    if (credential.id === 'new') {
      const { id, ...data } = formData;
      onSave(data);
    } else {
      onSave(formData);
    }
  }

  const tdStyle: React.CSSProperties = { padding: '10px 16px' };
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, fontFamily: 'inherit',
  };

  if (isEditing) {
    return (
      <tr style={{ background: '#eff6ff' }}>
        <td style={tdStyle}><input style={inputStyle} value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} placeholder="Nome" /></td>
        <td style={tdStyle}><input style={inputStyle} value={formData.login} onChange={e => setFormData({ ...formData, login: e.target.value })} placeholder="Login" /></td>
        <td style={tdStyle}><input style={inputStyle} type="text" value={formData.password || ''} onChange={e => setFormData({ ...formData, password: e.target.value })} placeholder="Password" /></td>
        <td style={tdStyle}><input style={inputStyle} type="url" value={formData.url} onChange={e => setFormData({ ...formData, url: e.target.value })} placeholder="https://..." /></td>
        <td style={tdStyle}><input style={inputStyle} value={formData.notes || ''} onChange={e => setFormData({ ...formData, notes: e.target.value })} placeholder="Notas" /></td>
        <td style={tdStyle}><input type="checkbox" checked={formData.active} onChange={e => setFormData({ ...formData, active: e.target.checked })} /></td>
        <td style={tdStyle}>
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={handleSubmit} style={{ padding: '4px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Guardar</button>
            <button onClick={onCancel} style={{ padding: '4px 10px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ ...tdStyle, fontWeight: 500, color: '#111827' }}>{credential.name}</td>
      <td style={{ ...tdStyle, color: '#374151' }}>{credential.login}</td>
      <td style={{ ...tdStyle, color: '#374151', fontFamily: 'monospace' }}>{credential.has_password ? '••••••••' : '—'}</td>
      <td style={tdStyle}>
        <a href={credential.url} target="_blank" rel="noopener noreferrer" style={{ color: '#00AEEF', fontSize: 12, textDecoration: 'none', display: 'block', maxWidth: 200, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
          {credential.url}
        </a>
      </td>
      <td style={{ ...tdStyle, color: '#6b7280', fontSize: 12 }}>{credential.notes || '—'}</td>
      <td style={tdStyle}>
        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: credential.active ? '#dcfce7' : '#f3f4f6', color: credential.active ? '#15803d' : '#6b7280', border: `1px solid ${credential.active ? '#bbf7d0' : '#e5e7eb'}` }}>
          {credential.active ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td style={tdStyle}>
        <div style={{ display: 'flex', gap: 6 }}>
          <button onClick={onEdit} style={{ padding: '4px 10px', background: '#00AEEF', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Editar</button>
          <button onClick={() => onDelete(credential.id)} style={{ padding: '4px 10px', background: '#dc2626', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Eliminar</button>
        </div>
      </td>
    </tr>
  );
}

// ── Users tab ─────────────────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<AppUser[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [createForm, setCreateForm] = useState({ login: '', password: '', role: 'user' as 'admin' | 'user' });
  const [createError, setCreateError] = useState('');
  const [saving, setSaving] = useState(false);

  async function loadUsers() {
    setLoading(true);
    try {
      setUsers(await getUsers());
    } catch { }
    finally { setLoading(false); }
  }

  useEffect(() => { loadUsers(); }, []);

  async function handleCreate() {
    setCreateError('');
    if (!createForm.login.trim() || !createForm.password.trim()) {
      setCreateError('Login e password são obrigatórios');
      return;
    }
    setSaving(true);
    try {
      await createUser(createForm);
      setShowCreate(false);
      setCreateForm({ login: '', password: '', role: 'user' });
      await loadUsers();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Erro ao criar utilizador';
      setCreateError(msg);
    } finally { setSaving(false); }
  }

  const tdStyle: React.CSSProperties = { padding: '12px 16px' };

  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <span style={{ fontSize: 13, color: '#6b7280' }}>
          {users.length} utilizador{users.length !== 1 ? 'es' : ''}
        </span>
        <button
          onClick={() => { setShowCreate(true); setCreateError(''); }}
          disabled={showCreate}
          style={{
            padding: '7px 16px', fontSize: 13, fontWeight: 500,
            background: showCreate ? '#d1d5db' : '#00AEEF',
            color: '#fff', border: 'none', borderRadius: 4, cursor: showCreate ? 'not-allowed' : 'pointer',
            fontFamily: 'inherit',
          }}
        >
          + Novo utilizador
        </button>
      </div>

      {/* Create form */}
      {showCreate && (
        <div style={{ background: '#eff6ff', border: '1px solid #bfdbfe', borderRadius: 6, padding: '16px 20px', marginBottom: 16 }}>
          <p style={{ fontSize: 13, fontWeight: 600, color: '#1d4ed8', marginBottom: 12 }}>Novo utilizador</p>
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap', alignItems: 'flex-end' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Login</label>
              <input
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, fontFamily: 'inherit', width: 200 }}
                value={createForm.login}
                onChange={e => setCreateForm({ ...createForm, login: e.target.value })}
                placeholder="utilizador@empresa.pt"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Password</label>
              <input
                type="password"
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, fontFamily: 'inherit', width: 180 }}
                value={createForm.password}
                onChange={e => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="••••••••"
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: 11, fontWeight: 600, color: '#374151', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Papel</label>
              <select
                style={{ padding: '6px 10px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 13, fontFamily: 'inherit', background: '#fff' }}
                value={createForm.role}
                onChange={e => setCreateForm({ ...createForm, role: e.target.value as 'admin' | 'user' })}
              >
                <option value="user">Utilizador</option>
                <option value="admin">Administrador</option>
              </select>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <button
                onClick={handleCreate}
                disabled={saving}
                style={{ padding: '7px 14px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}
              >
                {saving ? 'A criar...' : 'Criar'}
              </button>
              <button
                onClick={() => { setShowCreate(false); setCreateError(''); }}
                style={{ padding: '7px 14px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 4, fontSize: 13, cursor: 'pointer', fontFamily: 'inherit' }}
              >
                Cancelar
              </button>
            </div>
          </div>
          {createError && <p style={{ marginTop: 10, fontSize: 12, color: '#dc2626' }}>{createError}</p>}
        </div>
      )}

      <div style={{ background: '#fff', borderRadius: 6, border: '1px solid #e5e7eb', overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>A carregar...</div>
        ) : users.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
            Nenhum utilizador encontrado.
          </div>
        ) : (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ background: '#f5f6f7', borderBottom: '1px solid #e5e7eb' }}>
                {['Login', 'Papel', 'Estado', 'Criado em', 'Acções'].map(h => (
                  <th key={h} style={{ padding: '10px 16px', textAlign: 'left', fontWeight: 600, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px', color: '#374151' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <UserRow
                  key={u.id}
                  user={u}
                  isEditing={editingId === u.id}
                  onEdit={() => setEditingId(u.id)}
                  onCancel={() => setEditingId(null)}
                  onSaved={async () => { setEditingId(null); await loadUsers(); }}
                />
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

interface UserRowProps {
  user: AppUser;
  isEditing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSaved: () => Promise<void>;
}

function UserRow({ user, isEditing, onEdit, onCancel, onSaved }: UserRowProps) {
  const [form, setForm] = useState({ login: user.login, role: user.role, active: user.active, password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { setForm({ login: user.login, role: user.role, active: user.active, password: '' }); }, [user]);

  async function handleSave() {
    setError('');
    setSaving(true);
    try {
      const payload: any = { login: form.login, role: form.role, active: form.active };
      if (form.password.trim()) payload.password = form.password;
      await updateUser(user.id, payload);
      await onSaved();
    } catch (err: any) {
      const msg = err?.response?.data?.error || err?.message || 'Erro ao guardar';
      setError(msg);
    } finally { setSaving(false); }
  }

  const tdStyle: React.CSSProperties = { padding: '12px 16px' };
  const inputStyle: React.CSSProperties = { padding: '5px 8px', border: '1px solid #d1d5db', borderRadius: 4, fontSize: 12, fontFamily: 'inherit' };

  if (isEditing) {
    return (
      <>
        <tr style={{ background: '#eff6ff', borderBottom: '1px solid #bfdbfe' }}>
          <td style={tdStyle}>
            <input style={{ ...inputStyle, width: 200 }} value={form.login} onChange={e => setForm({ ...form, login: e.target.value })} />
          </td>
          <td style={tdStyle}>
            <select style={{ ...inputStyle, background: '#fff' }} value={form.role} onChange={e => setForm({ ...form, role: e.target.value as 'admin' | 'user' })}>
              <option value="user">Utilizador</option>
              <option value="admin">Administrador</option>
            </select>
          </td>
          <td style={tdStyle}>
            <label style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={form.active} onChange={e => setForm({ ...form, active: e.target.checked })} />
              {form.active ? 'Activo' : 'Inactivo'}
            </label>
          </td>
          <td style={tdStyle}>
            <input type="password" style={{ ...inputStyle, width: 140 }} value={form.password} onChange={e => setForm({ ...form, password: e.target.value })} placeholder="Nova password (opcional)" />
          </td>
          <td style={tdStyle}>
            <div style={{ display: 'flex', gap: 6 }}>
              <button onClick={handleSave} disabled={saving} style={{ padding: '4px 10px', background: '#16a34a', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: saving ? 'not-allowed' : 'pointer', fontFamily: 'inherit' }}>
                {saving ? '...' : 'Guardar'}
              </button>
              <button onClick={onCancel} style={{ padding: '4px 10px', background: '#6b7280', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Cancelar</button>
            </div>
            {error && <p style={{ marginTop: 4, fontSize: 11, color: '#dc2626' }}>{error}</p>}
          </td>
        </tr>
      </>
    );
  }

  const createdAt = new Date(user.created_at).toLocaleDateString('pt-PT');

  return (
    <tr style={{ borderBottom: '1px solid #f3f4f6' }}>
      <td style={{ ...tdStyle, fontWeight: 500, color: '#111827' }}>{user.login}</td>
      <td style={tdStyle}>
        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: user.role === 'admin' ? '#eff6ff' : '#f3f4f6', color: user.role === 'admin' ? '#1d4ed8' : '#374151', border: `1px solid ${user.role === 'admin' ? '#bfdbfe' : '#e5e7eb'}` }}>
          {user.role === 'admin' ? 'Administrador' : 'Utilizador'}
        </span>
      </td>
      <td style={tdStyle}>
        <span style={{ padding: '2px 8px', borderRadius: 20, fontSize: 11, fontWeight: 500, background: user.active ? '#dcfce7' : '#f3f4f6', color: user.active ? '#15803d' : '#6b7280', border: `1px solid ${user.active ? '#bbf7d0' : '#e5e7eb'}` }}>
          {user.active ? 'Activo' : 'Inactivo'}
        </span>
      </td>
      <td style={{ ...tdStyle, color: '#6b7280', fontSize: 12 }}>{createdAt}</td>
      <td style={tdStyle}>
        <button onClick={onEdit} style={{ padding: '4px 10px', background: '#00AEEF', color: '#fff', border: 'none', borderRadius: 4, fontSize: 12, cursor: 'pointer', fontFamily: 'inherit' }}>Editar</button>
      </td>
    </tr>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────

export default function AdminPage() {
  const [tab, setTab] = useState<'suppliers' | 'users'>('suppliers');

  return (
    <div style={{ minHeight: '100vh', background: '#f3f4f6', padding: '24px 24px 48px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>

        {/* Tab bar */}
        <div style={{ display: 'flex', gap: 4, marginBottom: 20, background: '#fff', padding: '6px 8px', borderRadius: 6, border: '1px solid #e5e7eb', width: 'fit-content' }}>
          <button style={tabStyle(tab === 'suppliers')} onClick={() => setTab('suppliers')}>
            Fornecedores
          </button>
          <button style={tabStyle(tab === 'users')} onClick={() => setTab('users')}>
            Utilizadores
          </button>
        </div>

        {tab === 'suppliers' ? <SuppliersTab /> : <UsersTab />}
      </div>
    </div>
  );
}
