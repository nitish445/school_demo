import { initializeApp } from "firebase-admin/app";

initializeApp();

// Cloud Functions are added incrementally:
// - assignUserClaims (onCall, admin-only): sets custom claims from users/{uid}
// - onUserWrite (Firestore trigger): keeps role-profile docs in sync
// - onAttendanceWrite: rolls up attendance into monthly summaries
// - onAnnouncementCreate / onHomeworkCreate: sends FCM push notifications
// - generateFeeReceipt (onCall): records a fee payment and returns a receipt
export {};
