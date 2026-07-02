"use client";

import { useEffect, useState } from "react";
import { doc, onSnapshot, type DocumentData } from "firebase/firestore";
import { db } from "@/lib/firebase";

/** Live-subscribes to a single Firestore document. */
export function useDoc<T extends DocumentData>(path: string | null) {
  const [data, setData] = useState<(T & { id: string }) | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!path) {
      // Resetting when the caller doesn't have a path yet (e.g. schoolId not
      // loaded) is intentional, not a render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    const unsubscribe = onSnapshot(doc(db, path), (snap) => {
      setData(snap.exists() ? ({ id: snap.id, ...(snap.data() as T) }) : null);
      setLoading(false);
    });
    return unsubscribe;
  }, [path]);

  return { data, loading };
}
