"use client";

import { useRef, useState, type ChangeEvent } from "react";
import { Camera } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { describeProfilePictureError, updateProfilePicture } from "@/lib/profilePicture";

export function ProfilePictureEditor({
  uid,
  name,
  photoUrl,
  extraDocPaths,
}: {
  uid: string;
  name: string;
  photoUrl?: string | null;
  extraDocPaths: string[];
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ""; // allow re-selecting the same file later
    if (!file) return;
    const validationError = describeProfilePictureError(file);
    if (validationError) {
      setError(validationError);
      return;
    }
    setError(null);
    setUploading(true);
    try {
      await updateProfilePicture(uid, file, extraDocPaths);
    } catch {
      setError("Could not upload the picture. Please try again.");
    } finally {
      setUploading(false);
    }
  }

  return (
    <div>
      <div className="relative inline-flex rounded-full ring-4 ring-white">
        <Avatar name={name} photoUrl={photoUrl} size="lg" />
        <button
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          aria-label="Change photo"
          className="absolute right-0 bottom-0 flex h-7 w-7 items-center justify-center rounded-full bg-stone-900 text-white ring-2 ring-white transition hover:bg-stone-700 disabled:opacity-60"
        >
          <Camera className="h-3.5 w-3.5" strokeWidth={2} />
        </button>
        <input ref={inputRef} type="file" accept="image/*" onChange={handleFile} className="hidden" />
      </div>
      {uploading && <p className="mt-1.5 text-xs text-stone-500">Uploading...</p>}
      {error && <p className="mt-1.5 text-xs text-rose-600">{error}</p>}
    </div>
  );
}
