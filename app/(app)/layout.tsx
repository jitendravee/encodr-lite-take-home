"use client";

import { useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/client/auth-context";

// PROVIDED IN FULL. Everything under app/(app)/ is behind this guard: if there's no signed-in
// user once hydration has finished, we send them to /signin.
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, ready, logout } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (ready && !user) router.replace("/signin");
  }, [ready, user, router]);

  if (!ready || !user) {
    return <div className="p-8 text-sm text-neutral-500">Loading…</div>;
  }

  return (
    <div className="mx-auto min-h-screen max-w-3xl px-4 py-6">
      <header className="mb-8 flex items-center justify-between border-b border-neutral-200 pb-4">
        <Link href="/jobs" className="text-lg font-semibold">
          🎬 Encodr Lite
        </Link>
        <div className="flex items-center gap-3 text-sm">
          <span className="text-neutral-500">{user.email}</span>
          <button
            onClick={logout}
            className="rounded-md cursor-pointer border border-neutral-300 px-3 py-1 hover:bg-white/10"
          >
            Sign out
          </button>
        </div>
      </header>
      {children}
    </div>
  );
}
