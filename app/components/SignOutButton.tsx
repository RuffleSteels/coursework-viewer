"use client";

import { signOut } from "next-auth/react";

export function SignOutButton() {
  const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "/coursework";

  return (
    <button
      onClick={() => signOut({ callbackUrl: basePath })}
      className="editor-title"
      style={{
        background: 'none',
        border: 'none',
        color: 'inherit',
        cursor: 'pointer',
        padding: 0,
        font: 'inherit',
        width: '100%',
        textAlign: 'right'
      }}
    >
      Sign Out
    </button>
  );
}
