"use client";

import { auth, db } from "@/lib/firebase";
import type { AppUser, Role } from "@/types/models";
import {
    signOut as firebaseSignOut,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    type User,
} from "firebase/auth";
import { doc, getDoc } from "firebase/firestore";
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
  refreshClaims: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<Claims | null>(null);
  const [profile, setProfile] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(true);

  async function loadClaims(firebaseUser: User | null) {
    if (!firebaseUser) {
      setClaims(null);
      setProfile(null);
      return;
    }

    let claimsFromToken: Claims = {};
    try {
      const tokenResult = await firebaseUser.getIdTokenResult(false);
      claimsFromToken = (tokenResult.claims as Claims) ?? {};
    } catch (error) {
      console.warn("Unable to refresh Firebase claims; falling back to Firestore profile.", error);
    }

    setClaims(claimsFromToken);

    try {
      const userDoc = await getDoc(doc(db, `users/${firebaseUser.uid}`));
      if (userDoc.exists()) {
        const data = userDoc.data() as Partial<AppUser>;
        const resolvedProfile = {
          uid: firebaseUser.uid,
          schoolId: data.schoolId ?? claimsFromToken.schoolId ?? "",
          role: (data.role ?? claimsFromToken.role ?? "parent") as Role,
          displayName: data.displayName ?? firebaseUser.displayName ?? firebaseUser.email ?? "User",
          email: data.email ?? firebaseUser.email ?? "",
          status: data.status ?? "active",
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
    } catch (error) {
      console.warn("Unable to load user profile from Firestore.", error);
      setProfile(null);
    }
  }

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      try {
        await loadClaims(firebaseUser);
      } catch (error) {
        console.warn("Auth initialization failed.", error);
      } finally {
        setLoading(false);
      }
    });
    return unsubscribe;
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
