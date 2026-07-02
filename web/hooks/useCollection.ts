"use client";

import { useEffect, useState } from "react";
import {
  collection,
  onSnapshot,
  query,
  type QueryConstraint,
  type DocumentData,
} from "firebase/firestore";
import { db } from "@/lib/firebase";

/**
 * Live-subscribes to a Firestore collection and maps docs to `{ id, ...data }`.
 * Pass `deps` (e.g. `[classId, date]`) so the query re-subscribes when the
 * *values* used to build `constraints` change -- `constraints` itself is a
 * new array every render so it can't be used as a dependency directly.
 */
export function useCollection<T extends DocumentData>(
  path: string | null,
  constraints: QueryConstraint[] = [],
  deps: unknown[] = []
) {
  const [data, setData] = useState<(T & { id: string })[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<Error | null>(null);

  useEffect(() => {
    if (!path) {
      // Resetting to the empty/idle state when the caller doesn't have a
      // path yet (e.g. schoolId not loaded) is intentional, not a render loop.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setData([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    const q = query(collection(db, path), ...constraints);
    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        setData(snapshot.docs.map((d) => ({ id: d.id, ...(d.data() as T) })));
        setLoading(false);
      },
      (err) => {
        setError(err);
        setLoading(false);
      }
    );
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps]);

  return { data, loading, error };
}
