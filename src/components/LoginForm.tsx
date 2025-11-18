'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LoginForm() {
  const router = useRouter();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password }),
      });

      if (!res.ok) {
        setError('Invalid credentials.');
        return;
      }

      // si ok: redirection vers now-playing
      router.push('/now-playing');
    } catch {
      setError('Login error, please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="w-full max-w-sm rounded-2xl border border-white/10 bg-white/5 p-6 backdrop-blur-md"
    >
      <h2 className="mb-4 text-lg font-semibold text-white">
        Wakama Oracle dashboard
      </h2>
      <p className="mb-6 text-xs text-white/60">
        Private access for Solana Foundation reviewer.
      </p>

      <div className="mb-4">
        <label className="mb-1 block text-xs text-white/70">
          User
        </label>
        <input
          type="text"
          autoComplete="username"
          value={username}
          onChange={(e) => setUsername(e.target.value)}
          className="w-full rounded-lg border border-white/15 bg-[#050712] px-3 py-2 text-sm text-white outline-none focus:border-[#14F195]"
          required
        />
      </div>

      <div className="mb-4">
        <label className="mb-1 block text-xs text-white/70">
          Password
        </label>
        <input
          type="password"
          autoComplete="current-password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="w-full rounded-lg border border-white/15 bg-[#050712] px-3 py-2 text-sm text-white outline-none focus:border-[#14F195]"
          required
        />
      </div>

      {error && (
        <p className="mb-3 text-xs text-red-400">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={submitting}
        className="mt-1 inline-flex w-full items-center justify-center rounded-lg bg-[#14F195] px-4 py-2 text-sm font-semibold text-black shadow-md hover:opacity-90 disabled:opacity-60"
      >
        {submitting ? 'Checking...' : 'Enter dashboard'}
      </button>

      <p className="mt-4 text-[10px] text-white/40">
        Powered by Wakama.farm • Solana Foundation grant.
      </p>
    </form>
  );
}
