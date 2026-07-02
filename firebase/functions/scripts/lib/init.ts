import { applicationDefault, getApps, initializeApp } from "firebase-admin/app";

/** Idempotent Admin SDK init shared by every script in this directory. */
export function initAdmin() {
  if (getApps().length === 0) {
    initializeApp({ credential: applicationDefault() });
  }
}
