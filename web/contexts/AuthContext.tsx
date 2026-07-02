"use client";

import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  signOut as firebaseSignOut,
  type User,
} from "firebase/auth";
import { auth } from "@/lib/firebase";
import type { Role } from "@/types/models";

interface Claims {
  role?: Role;
  schoolId?: string;
  classIds?: string[];
  subjectIds?: string[];
}

interface AuthContextValue {
  user: User | null;
  claims: Claims | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Claims | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadClaims(firebaseUser: User | null) {
    if (!firebaseUser) {
      setClaims(null);
      return;
    }
    // `forceRefresh: true` picks up custom claims right after they've just
    // been set by the assignUserClaims Cloud Function (which runs after the
    // admin creates a users/{uid} doc), avoiding a stale cached token.
    const tokenResult = await firebaseUser.getIdTokenResult(true);
    setClaims(tokenResult.claims as Claims);
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      await loadClaims(firebaseUser);
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      claims,
      loading,
      async signIn(email: string, password: string) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signOut() {
        await firebaseSignOut(auth);
      },
      async refreshClaims() {
        await loadClaims(auth.currentUser);
      },
    }),
    [user, claims, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
