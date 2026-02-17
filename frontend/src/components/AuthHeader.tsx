'use client';

import React from 'react';
import { usePathname, useRouter } from 'next/navigation';

export default function AuthHeader() {
  const pathname = usePathname();
  const router = useRouter();

  const isConfig = pathname?.startsWith('/admin');

  async function handleLogout() {
    try {
      await fetch('/auth/logout', { method: 'POST', credentials: 'include' });
    } catch {}
    router.push('/login');
  }

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">ProductScout</h1>
          <p className="text-sm text-gray-600 mt-1">Universal automotive parts lookup & comparison</p>
          <nav className="mt-4 -mb-px flex space-x-8">
            <button
              onClick={() => router.push('/')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                !isConfig ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Search
            </button>
            <button
              onClick={() => router.push('/admin')}
              className={`py-2 px-1 border-b-2 font-medium text-sm transition-colors ${
                isConfig ? 'border-blue-500 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              Config
            </button>
          </nav>
        </div>
        <div>
          <button
            onClick={handleLogout}
            className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 transition-colors"
          >
            Logout
          </button>
        </div>
      </div>
    </header>
  );
}

