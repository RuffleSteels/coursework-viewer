"use client";

import { signIn } from "next-auth/react";
import { useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

// 1. Move your logic into a sub-component
function SignInForm() {
  const searchParams = useSearchParams();
  const basePath =
      process.env.NEXT_PUBLIC_BASE_PATH || "/coursework";

  const callbackUrl =
      searchParams.get("callbackUrl") || basePath;
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");

    try {
      const res = await signIn("credentials", {
        username,
        password,
        redirect: false,
      });

      if (res?.error) {
        setError("Invalid username or password");
        setLoading(false);
      } else {
        window.location.href = callbackUrl;
      }
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

  return (
      <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
        {/* ... keep your existing form inputs here ... */}
        <div className="prop-input-wrap">
          <label className="prop-label">Username</label>
          <input
              type="text"
              className="title-field"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin"
              required
          />
        </div>
        <div className="prop-input-wrap">
          <label className="prop-label">Password</label>
          <input
              type="password"
              className="title-field"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              required
          />
        </div>

        {error && <p style={{ color: '#e07070', fontSize: '12px' }}>{error}</p>}

        <button
            type="submit"
            className="btn btn--accent"
            style={{ width: '100%', justifyContent: 'center', padding: '12px' }}
            disabled={loading}
        >
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </form>
  );
}

// 2. The main export wraps the form in Suspense
export default function SignIn() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/coursework";

  return (
      <div className="page" style={{ justifyContent: 'center', alignItems: 'center' }}>
        <div style={{
          width: '100%',
          maxWidth: '400px',
          padding: '40px',
          background: 'var(--surface)',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
          display: 'flex',
          flexDirection: 'column',
          gap: '24px'
        }}>
          <div style={{ textAlign: 'center' }}>
            <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>Admin Login</p>
          </div>

          <Suspense fallback={<div>Loading...</div>}>
            <SignInForm />
          </Suspense>

          <div style={{ textAlign: 'center', borderTop: '1px solid var(--border)', paddingTop: '16px' }}>
            <Link
                href={`/`}
                className="btn"
                style={{
                  width: '100%',
                  justifyContent: 'center',
                  padding: '12px',
                  display: 'flex',
                  marginTop: '8px',
                  background: 'transparent',
                  border: '1px solid var(--border)',
                  color: 'var(--text-muted)',
                  fontSize: '14px',
                  textDecoration: 'none'
                }}
            >
              ← Back to Home
            </Link>
          </div>
        </div>
      </div>
  );
}
