"use client";

import { signIn } from "next-auth/react";

function GoogleIcon() {
  return (
    <svg className="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M23.49 12.27c0-.79-.07-1.54-.2-2.27H12v4.51h6.47c-.28 1.48-1.13 2.73-2.4 3.58v2.98h3.89c2.28-2.1 3.53-5.19 3.53-8.8z"
        fill="#4285F4"
      />
      <path
        d="M12 24c3.24 0 5.95-1.07 7.93-2.9l-3.89-2.98c-1.08.72-2.46 1.15-4.04 1.15-3.11 0-5.74-2.1-6.68-4.92H1.3v3.07C3.26 21.3 7.31 24 12 24z"
        fill="#34A853"
      />
      <path
        d="M5.32 14.35c-.24-.72-.38-1.49-.38-2.28s.14-1.56.38-2.28V6.72H1.3A11.98 11.98 0 000 12.07c0 1.94.47 3.77 1.3 5.35l4.02-3.07z"
        fill="#FBBC05"
      />
      <path
        d="M12 4.75c1.76 0 3.34.6 4.58 1.79l3.44-3.44C17.95 1.19 15.24 0 12 0 7.31 0 3.26 2.7 1.3 6.72l4.02 3.07C6.26 6.97 8.89 4.75 12 4.75z"
        fill="#EA4335"
      />
    </svg>
  );
}

export function GoogleButton({ label, callbackUrl }: { label: string; callbackUrl: string }) {
  return (
    <button
      type="button"
      onClick={() => signIn("google", { callbackUrl })}
      className="inline-flex h-12 w-full items-center justify-center gap-3 rounded-2xl border border-[var(--border)] bg-white px-4 text-sm font-semibold text-[var(--foreground)] shadow-sm hover:bg-slate-50"
    >
      <GoogleIcon />
      {label}
    </button>
  );
}
