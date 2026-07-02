import { initializeApp } from "firebase-admin/app";

initializeApp();

export { createStaffOrParentAccount, setAccountStatus, bulkCreateAccounts } from "./accounts";
export { setTeacherAssignments } from "./teacherAssignments";
export { onStudentWrite } from "./studentSync";

// Added incrementally as the corresponding feature modules are built:
// - onAttendanceWrite: rolls up attendance into monthly summaries
// - onAnnouncementCreate / onHomeworkCreate: FCM push notifications
// - generateFeeReceipt (onCall): records a fee payment, returns a receipt
