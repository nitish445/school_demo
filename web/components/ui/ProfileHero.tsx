import type { ReactNode } from "react";
import { ProfilePictureEditor } from "@/components/ui/ProfilePictureEditor";

export function ProfileHero({
  uid,
  name,
  subtitle,
  photoUrl,
  extraDocPaths,
  badges,
}: {
  uid: string;
  name: string;
  subtitle?: string;
  photoUrl?: string | null;
  extraDocPaths: string[];
  badges?: ReactNode;
}) {
  return (
    <div className="overflow-hidden rounded-2xl border border-stone-200/80 bg-white shadow-[0_2px_10px_-2px_rgba(41,27,10,0.06)]">
      <div className="h-24 bg-[radial-gradient(circle_at_15%_-40%,rgba(251,191,36,0.35),transparent_60%),linear-gradient(to_bottom_right,var(--color-stone-900),var(--color-stone-950))]" />
      <div className="px-6 pb-6">
        {/* Only the avatar overlaps the banner -- the text sits fully in the
            white area below it, so it stays readable regardless of how many
            lines (name/subtitle/badges) end up in this block. */}
        <div className="-mt-10 inline-block">
          <ProfilePictureEditor uid={uid} name={name} photoUrl={photoUrl} extraDocPaths={extraDocPaths} />
        </div>
        <div className="mt-3">
          <h1 className="font-serif text-2xl font-semibold tracking-tight text-stone-900">{name}</h1>
          {subtitle && <p className="text-sm text-stone-500">{subtitle}</p>}
          {badges && <div className="mt-2 flex flex-wrap gap-2">{badges}</div>}
        </div>
      </div>
    </div>
  );
}
