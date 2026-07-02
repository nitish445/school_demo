"use client";

import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import type { Role } from "@/types/models";
import { sendPasswordResetEmail } from "firebase/auth";
import { useRouter } from "next/navigation";
import { useEffect, useState, type FormEvent } from "react";

const DASHBOARD_PATH: Record<Role, string> = {
  admin: "/admin",
  classTeacher: "/teacher",
  subjectTeacher: "/teacher",
  parent: "/parent",
};

export default function LoginPage() {
  const { user, claims, profile, loading, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (!loading && user) {
      const resolvedRole = (profile?.role ?? claims?.role ?? "admin") as Role;
      router.replace(DASHBOARD_PATH[resolvedRole]);
    }
  }, [loading, user, claims, profile, router]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSuccess(null);
    setSubmitting(true);
    try {
      await signIn(email, password);
    } catch {
      setError("Invalid email or password. If you just created the account, try resetting the password.");
    } finally {
      setSubmitting(false);
    }
  }

  async function handleResetPassword() {
    if (!email.trim()) {
      setError("Enter your email address first.");
      return;
    }

    setError(null);
    setSuccess(null);
    setResetting(true);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setSuccess("Password reset email sent. Check your inbox.");
    } catch {
      setError("Could not send a password reset email. Check the email address and Firebase settings.");
    } finally {
      setResetting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-[radial-gradient(circle_at_top,_#eef4ff,_#f8fbff_55%,_#eef2ff)] p-4 text-slate-800">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-indigo-100 bg-white/90 p-8 shadow-[0_20px_60px_-20px_rgba(79,70,229,0.35)] backdrop-blur"
      >
        <div className="mb-6 flex items-center gap-3">
          <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-indigo-600 text-lg font-semibold text-white">
            S
          </div>
          <div>
            <h1 className="text-xl font-semibold text-slate-900">School Portal</h1>
            <p className="text-sm text-slate-500">Sign in with your school credentials.</p>
          </div>
        </div>

        <label className="mb-1 block text-sm font-medium text-slate-700">Email</label>
        <input
          type="email"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white"
        />

        <label className="mb-1 block text-sm font-medium text-slate-700">Password</label>
        <input
          type="password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mb-4 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 text-sm text-slate-900 outline-none transition focus:border-indigo-500 focus:bg-white"
        />

        {error && <p className="mb-4 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>}
        {success && <p className="mb-4 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</p>}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-indigo-600 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {submitting ? "Signing in..." : "Sign in"}
        </button>

        <button
          type="button"
          onClick={handleResetPassword}
          disabled={resetting}
          className="mt-3 w-full rounded-lg border border-slate-200 bg-white py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {resetting ? "Sending reset email..." : "Forgot password?"}
        </button>
      </form>
    </div>
  );
}
