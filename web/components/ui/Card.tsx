import type { ReactNode } from "react";
import { cardClass } from "./formStyles";

export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`${cardClass} ${className}`}>{children}</div>;
}
