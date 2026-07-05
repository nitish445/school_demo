"use client";

import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { doc, writeBatch } from "firebase/firestore";
import { db, storage } from "@/lib/firebase";

export const MAX_PROFILE_PICTURE_BYTES = 3 * 1024 * 1024;

export function describeProfilePictureError(file: File): string | null {
  if (!file.type.startsWith("image/")) return "Please choose an image file.";
  if (file.size > MAX_PROFILE_PICTURE_BYTES) return "Image must be smaller than 3MB.";
  return null;
}

/**
 * Uploads a profile picture to a fixed path per user (so re-uploading just
 * replaces it, rather than accumulating files), then writes the resulting
 * URL to `users/{uid}` plus whichever role-specific docs also denormalize it
 * (`teachers/{uid}`, `parents/{uid}`, `schools/{schoolId}/admins/{uid}`) so
 * it shows up anywhere that role is looked up, e.g. the Teacher Directory.
 */
export async function updateProfilePicture(uid: string, file: File, extraDocPaths: string[]): Promise<string> {
  const fileRef = ref(storage, `profile-pictures/${uid}/photo`);
  await uploadBytes(fileRef, file, { contentType: file.type });
  const photoUrl = await getDownloadURL(fileRef);

  const batch = writeBatch(db).set(doc(db, `users/${uid}`), { photoUrl }, { merge: true });
  for (const path of extraDocPaths) {
    batch.set(doc(db, path), { photoUrl }, { merge: true });
  }
  await batch.commit();

  return photoUrl;
}
