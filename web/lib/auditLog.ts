"use client";

import { addDoc, collection, serverTimestamp } from "firebase/firestore";
import { db } from "@/lib/firebase";
import type { User } from "firebase/auth";

export type AuditAction = "create" | "update" | "delete";

/**
 * Records who changed what, for the Admin Activity Log. Best-effort: a
 * failure here shouldn't block the actual write it's describing, so callers
 * fire-and-forget this (no await in the UI's critical path) and it
 * swallows its own errors.
 */
export function logActivity(
  schoolId: string,
  actor: User | null,
  action: AuditAction,
  entity: string,
  entityLabel: string
): void {
  if (!schoolId || !actor) return;
  addDoc(collection(db, `schools/${schoolId}/auditLog`), {
    action,
    entity,
    entityLabel,
    actorUid: actor.uid,
    actorEmail: actor.email ?? "",
    createdAt: serverTimestamp(),
  }).catch((err) => {
    console.warn("Failed to record activity log entry.", err);
  });
}
