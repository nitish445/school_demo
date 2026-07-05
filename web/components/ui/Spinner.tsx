import { Loader2 } from "lucide-react";

export function Spinner({ className = "py-10" }: { className?: string }) {
  return (
    <div className={`flex justify-center ${className}`}>
      <Loader2 className="h-5 w-5 animate-spin text-amber-500" strokeWidth={2.5} />
    </div>
  );
}
