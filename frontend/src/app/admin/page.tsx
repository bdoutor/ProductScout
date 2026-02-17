'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

interface SupplierCredential {
  id: string;
  name: string;
  login: string;
  has_password: boolean;
  url: string;
  notes?: string;
  active: boolean;
}

export default function AdminPage() {
  const router = useRouter();
  const [credentials, setCredentials] = useState<SupplierCredential[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function loadCredentials() {
    setLoading(true);
    try {
      const res = await fetch(`/admin/supplier-creds`, {
        credentials: 'include'
      });

      if (res.ok) {
        const data = await res.json();
        setCredentials(data);
      } else {
        console.error('Failed to load credentials');
      }
    } catch (error) {
      console.error('Error loading credentials:', error);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadCredentials();
  }, []);

  async function handleLogout() {
    try {
      await fetch(`/auth/logout`, {
        method: 'POST',
        credentials: 'include'
      });
      router.push('/login');
    } catch (error) {
      console.error('Logout error:', error);
    }
  }

  async function handleSave(cred: Partial<SupplierCredential>) {
    try {
      const method = cred.id ? 'PUT' : 'POST';
      const url = cred.id
        ? `/admin/supplier-creds/${cred.id}`
        : `/admin/supplier-creds`;

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(cred)
      });

      if (res.ok) {
        await loadCredentials();
        setEditingId(null);
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (error) {
      console.error('Save error:', error);
      alert('Failed to save credential');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Are you sure you want to delete this credential?')) {
      return;
    }

    try {
      const res = await fetch(`/admin/supplier-creds/${id}`, {
        method: 'DELETE',
        credentials: 'include'
      });

      if (res.ok) {
        await loadCredentials();
      } else {
        alert('Failed to delete credential');
      }
    } catch (error) {
      console.error('Delete error:', error);
      alert('Failed to delete credential');
    }
  }

  function handleAddNew() {
    const newCred: SupplierCredential = {
      id: 'new',
      name: '',
      login: '',
      has_password: false,
      url: '',
      notes: '',
      active: true
    };
    setCredentials([newCred, ...credentials]);
    setEditingId('new');
  }

  function handleCancelNew() {
    setCredentials(credentials.filter(c => c.id !== 'new'));
    setEditingId(null);
  }

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <div className="max-w-7xl mx-auto">
        {/* Removed duplicated header (AuthHeader provides nav + logout) */}

        {/* Actions Bar */}
        <div className="bg-white rounded-lg shadow-md p-4 mb-6">
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-gray-900">
              Supplier Credentials ({credentials.length})
            </h2>
            <button
              onClick={handleAddNew}
              disabled={editingId !== null}
              className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors disabled:bg-gray-400 disabled:cursor-not-allowed"
            >
              + Add New Supplier
            </button>
          </div>
        </div>

        {/* Credentials Table */}
        <div className="bg-white rounded-lg shadow-md overflow-hidden">
          {loading ? (
            <div className="p-8 text-center">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto"></div>
              <p className="mt-2 text-gray-600">Loading credentials...</p>
            </div>
          ) : credentials.length === 0 ? (
            <div className="p-8 text-center text-gray-500">
              No supplier credentials found. Click "Add New Supplier" to create one.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className="bg-gray-100 border-b border-gray-200">
                  <tr>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Name</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Login</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Password</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">URL</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Notes</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Active</th>
                    <th className="px-4 py-3 text-left font-semibold text-gray-700">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {credentials.map((cred) => (
                    <CredentialRow
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
    </div>
  );
}

interface CredentialRowProps {
  credential: SupplierCredential;
  isEditing: boolean;
  onEdit: () => void;
  onSave: (cred: Partial<SupplierCredential>) => void;
  onCancel: () => void;
  onDelete: (id: string) => void;
}

function CredentialRow({ credential, isEditing, onEdit, onSave, onCancel, onDelete }: CredentialRowProps) {
  const [formData, setFormData] = useState(credential);

  useEffect(() => {
    setFormData(credential);
  }, [credential]);

  function handleSubmit() {
    if (!formData.name || !formData.login || (credential.id === 'new' && !(formData as any)['password']) || !formData.url) {
      alert('Please fill in all required fields (Name, Login, Password, URL)');
      return;
    }

    if (credential.id === 'new') {
      const { id, ...data } = formData;
      onSave(data);
    } else {
      onSave(formData);
    }
  }

  if (isEditing) {
    return (
      <tr className="bg-blue-50">
        <td className="px-4 py-3">
          <input
            type="text"
            className="w-full px-2 py-1 border border-gray-300 rounded"
            value={formData.name}
            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
            placeholder="Supplier name"
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="text"
            className="w-full px-2 py-1 border border-gray-300 rounded"
            value={formData.login}
            onChange={(e) => setFormData({ ...formData, login: e.target.value })}
            placeholder="Login username"
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="text"
            className="w-full px-2 py-1 border border-gray-300 rounded"
            value={(formData as any).password || ''}
            onChange={(e) => setFormData({ ...(formData as any), password: e.target.value } as any)}
            placeholder="Password"
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="url"
            className="w-full px-2 py-1 border border-gray-300 rounded"
            value={formData.url}
            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
            placeholder="https://..."
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="text"
            className="w-full px-2 py-1 border border-gray-300 rounded"
            value={formData.notes || ''}
            onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
            placeholder="Optional notes"
          />
        </td>
        <td className="px-4 py-3">
          <input
            type="checkbox"
            checked={formData.active}
            onChange={(e) => setFormData({ ...formData, active: e.target.checked })}
            className="h-4 w-4"
          />
        </td>
        <td className="px-4 py-3">
          <div className="flex gap-2">
            <button
              onClick={handleSubmit}
              className="px-3 py-1 bg-green-600 text-white rounded text-xs hover:bg-green-700"
            >
              Save
            </button>
            <button
              onClick={onCancel}
              className="px-3 py-1 bg-gray-500 text-white rounded text-xs hover:bg-gray-600"
            >
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className="hover:bg-gray-50">
      <td className="px-4 py-3 font-medium text-gray-900">{credential.name}</td>
      <td className="px-4 py-3 text-gray-700">{credential.login}</td>
      <td className="px-4 py-3 text-gray-700 font-mono">{'â€¢'.repeat(credential.has_password ? 8 : 0)}</td>
      <td className="px-4 py-3">
        <a
          href={credential.url}
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-600 hover:underline text-xs truncate block max-w-xs"
        >
          {credential.url}
        </a>
      </td>
      <td className="px-4 py-3 text-gray-600 text-xs">{credential.notes || '-'}</td>
      <td className="px-4 py-3">
        <span
          className={`inline-block px-2 py-1 text-xs rounded ${
            credential.active ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
          }`}
        >
          {credential.active ? 'Active' : 'Inactive'}
        </span>
      </td>
      <td className="px-4 py-3">
        <div className="flex gap-2">
          <button
            onClick={onEdit}
            className="px-3 py-1 bg-blue-600 text-white rounded text-xs hover:bg-blue-700"
          >
            Edit
          </button>
          <button
            onClick={() => onDelete(credential.id)}
            className="px-3 py-1 bg-red-600 text-white rounded text-xs hover:bg-red-700"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}






