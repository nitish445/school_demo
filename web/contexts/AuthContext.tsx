"use client";

import { auth, db } from "@/lib/firebase";
import type { AppUser, Role } from "@/types/models";
import {
    signOut as firebaseSignOut,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    type User,
} from "firebase/auth";
import { doc, onSnapshot } from "firebase/firestore";
import {
    createContext,
    useContext,
    useEffect,
    useMemo,
    useState,
    type ReactNode,
} from "react";

interface Claims {
  role?: Role;
  schoolId?: string;
  classIds?: string[];
  subjectIds?: string[];
}

interface AuthContextValue {
  user: User | null;
  claims: Claims | null;
  profile: AppUser | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Claims | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  // A single state machine per auth callback invocation -- not two separate
  // effects racing each other. Firebase can call onAuthStateChanged more
  // than once while restoring a session (e.g. transiently with null before
  // the real user), and splitting "auth resolved" from "profile resolved"
  // into independent effects left a render where `loading` had already gone
  // false for a stale invocation while `profile`/`claims` hadn't caught up
  // to the new one yet -- RequireRole would then fall back to its "admin"
  // default and misroute. Tearing down and rebuilding the profile
  // subscription inside the same callback, with `loading` reset to true at
  // its start, closes that gap.
  useEffect(() => {
    let unsubscribeProfile: (() => void) | undefined;

    const unsubscribeAuth = onAuthStateChanged(auth, async (firebaseUser) => {
      unsubscribeProfile?.();
      unsubscribeProfile = undefined;

      setUser(firebaseUser);
      setLoading(true);

      if (!firebaseUser) {
        setClaims(null);
        setProfile(null);
        setLoading(false);
        return;
      }

      try {
        const tokenResult = await firebaseUser.getIdTokenResult(false);
        setClaims((tokenResult.claims as Claims) ?? {});
      } catch (error) {
        console.warn("Unable to refresh Firebase claims.", error);
        setClaims({});
      }

      // Live-subscribes (rather than a one-time getDoc) so a status/role/
      // designation change -- most importantly the Principal disabling this
      // account -- takes effect immediately in any open tab. RequireRole
      // watches `profile.status` and signs the user out the moment it flips
      // to "disabled", instead of waiting for their next login.
      unsubscribeProfile = onSnapshot(
        doc(db, `users/${firebaseUser.uid}`),
        (snap) => {
          if (snap.exists()) {
            const data = snap.data() as Partial<AppUser>;
            const resolvedProfile = {
              uid: firebaseUser.uid,
              schoolId: data.schoolId ?? "",
              role: (data.role ?? "parent") as Role,
              displayName: data.displayName ?? firebaseUser.displayName ?? firebaseUser.email ?? "User",
              email: data.email ?? firebaseUser.email ?? "",
              status: data.status ?? "active",
              designation: data.designation,
              photoUrl: data.photoUrl,
            } satisfies AppUser;
            setProfile(resolvedProfile);
            setClaims((prev) => ({
              ...prev,
              role: resolvedProfile.role,
              schoolId: resolvedProfile.schoolId,
            }));
          } else {
            setProfile(null);
          }
          setLoading(false);
        },
        (error) => {
          console.warn("Unable to load user profile from Firestore.", error);
          setProfile(null);
          setLoading(false);
        }
      );
    });

    return () => {
      unsubscribeAuth();
      unsubscribeProfile?.();
    };
  }, []);

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      claims,
      profile,
      loading,
      async signIn(email: string, password: string) {
        await signInWithEmailAndPassword(auth, email, password);
      },
      async signOut() {
        await firebaseSignOut(auth);
      },
    }),
    [user, claims, profile, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within an AuthProvider");
  return ctx;
}
