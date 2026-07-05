import { Loader2 } from "lucide-react";

export function FullScreenLoader() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#f2ecdd]">
      <Loader2 className="h-6 w-6 animate-spin text-amber-500" strokeWidth={2.5} />
    </div>
  );
}
