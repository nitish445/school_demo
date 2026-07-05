"use client";

import { useAuth } from "@/contexts/AuthContext";
import { auth } from "@/lib/firebase";
import type { Role } from "@/types/models";
import { sendPasswordResetEmail } from "firebase/auth";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense, useEffect, useState, type FormEvent } from "react";
import { GraduationCap, CalendarCheck, NotebookPen, Megaphone, AlertCircle, CheckCircle2 } from "lucide-react";
import { inputClass, labelClass, primaryButtonClass, secondaryButtonClass } from "@/components/ui/formStyles";

const DASHBOARD_PATH: Record<Role, string> = {
  admin: "/admin",
  classTeacher: "/teacher",
  subjectTeacher: "/teacher",
  parent: "/parent",
};

const HIGHLIGHTS = [
  { icon: CalendarCheck, text: "Track attendance in seconds" },
  { icon: NotebookPen, text: "Assign and grade homework" },
  { icon: Megaphone, text: "Keep parents in the loop" },
];

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}

function LoginForm() {
  const { user, claims, profile, loading, signIn, signOut } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [resetting, setResetting] = useState(false);

  useEffect(() => {
    if (searchParams.get("disabled") === "1") {
      // Reflecting the URL this page loaded with into local state is
      // intentional, not a render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("Your account has been disabled. Contact your school administrator.");
    }
    // Only meant to run once, off the URL this page loaded with.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (loading || !user) return;
    if (profile?.status === "disabled") {
      signOut();
      // Surfacing why we just signed them back out is intentional, not a
      // render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setError("Your account has been disabled. Contact your school administrator.");
      return;
    }
    const resolvedRole = (profile?.role ?? claims?.role ?? "admin") as Role;
    router.replace(DASHBOARD_PATH[resolvedRole]);
  }, [loading, user, claims, profile, router, signOut]);

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
    <div className="flex min-h-screen">
      <div className="relative hidden w-1/2 flex-col justify-between bg-linear-to-b from-stone-900 to-stone-950 p-12 text-white lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-amber-300 to-amber-600 text-stone-900 shadow-sm shadow-amber-900/40">
            <GraduationCap className="h-5 w-5" strokeWidth={2.25} />
          </div>
          <span className="font-serif text-lg font-semibold tracking-tight">School Portal</span>
        </div>

        <div>
          <h2 className="max-w-md font-serif text-4xl leading-tight font-semibold tracking-tight">
            Everything your school needs, in one place.
          </h2>
          <p className="mt-3 max-w-sm text-sm text-stone-300">
            Attendance, homework, fees, and communication for admins, teachers, and parents.
          </p>
          <div className="mt-8 space-y-3">
            {HIGHLIGHTS.map(({ icon: Icon, text }) => (
              <div key={text} className="flex items-center gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-400/10">
                  <Icon className="h-4 w-4 text-amber-400" strokeWidth={2} />
                </div>
                <span className="text-sm text-stone-200">{text}</span>
              </div>
            ))}
          </div>
        </div>

        <p className="text-xs text-stone-500">© {new Date().getFullYear()} School Portal</p>
      </div>

      <div className="flex flex-1 items-center justify-center bg-[#f2ecdd] p-6">
        <form onSubmit={handleSubmit} className="w-full max-w-sm">
          <div className="mb-8 flex items-center gap-2.5 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-linear-to-br from-amber-300 to-amber-600 text-stone-900 shadow-sm shadow-amber-900/40">
              <GraduationCap className="h-5 w-5" strokeWidth={2.25} />
            </div>
            <span className="font-serif text-lg font-semibold tracking-tight text-stone-900">School Portal</span>
          </div>

          <h1 className="font-serif text-2xl font-semibold tracking-tight text-stone-900">Sign in</h1>
          <p className="mt-1 mb-6 text-sm text-stone-500">Use the credentials your school gave you.</p>

          <label className={labelClass}>Email</label>
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className={`${inputClass} mb-4`}
          />

          <label className={labelClass}>Password</label>
          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className={`${inputClass} mb-4`}
          />

          {error && (
            <p className="mb-4 flex items-start gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              {error}
            </p>
          )}
          {success && (
            <p className="mb-4 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" strokeWidth={2} />
              {success}
            </p>
          )}

          <button type="submit" disabled={submitting} className={`${primaryButtonClass} w-full justify-center py-2.5`}>
            {submitting ? "Signing in..." : "Sign in"}
          </button>

          <button
            type="button"
            onClick={handleResetPassword}
            disabled={resetting}
            className={`${secondaryButtonClass} mt-3 w-full justify-center py-2.5`}
          >
            {resetting ? "Sending reset email..." : "Forgot password?"}
          </button>
        </form>
      </div>
    </div>
  );
}
