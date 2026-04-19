// app/auth/signin/page.tsx
"use client";

import { signIn } from "next-auth/react";
import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

export default function SignIn() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") || "/";

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
        redirect: false, // Keep false to handle errors manually
      });

      if (res?.error) {
        setError("Invalid username or password");
        setLoading(false);
      } else {
        // Force a hard navigation to ensure the session is picked up
        window.location.href = callbackUrl;
      }
    } catch (err) {
      setError("An unexpected error occurred");
      setLoading(false);
    }
  };

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
          {/*<Link href="/" className="nav-logo" style={{ fontSize: '32px' }}>Folium</Link>*/}
          <p style={{ color: 'var(--text-muted)', fontSize: '13px', marginTop: '8px' }}>Admin Login</p>
        </div>

        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
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
      </div>
    </div>
  );
}