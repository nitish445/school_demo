const SIZE_CLASSES = {
  sm: "h-7 w-7 text-xs",
  md: "h-12 w-12 text-base",
  lg: "h-20 w-20 text-2xl",
};

export function Avatar({
  name,
  photoUrl,
  size = "sm",
}: {
  name: string;
  photoUrl?: string | null;
  size?: keyof typeof SIZE_CLASSES;
}) {
  const sizeClass = SIZE_CLASSES[size];

  if (photoUrl) {
    // Arbitrary Firebase Storage download URLs, not a known/optimizable set.
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={photoUrl} alt={name} className={`${sizeClass} shrink-0 rounded-full object-cover`} />;
  }

  const initial = (name.trim().charAt(0) || "?").toUpperCase();
  return (
    <div
      className={`flex ${sizeClass} shrink-0 items-center justify-center rounded-full bg-linear-to-br from-amber-300 to-amber-600 font-semibold text-stone-900 shadow-sm shadow-amber-900/30`}
    >
      {initial}
    </div>
  );
}
