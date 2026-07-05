import type { ReactNode } from "react";
import { pageHeadingClass, mutedTextClass } from "./formStyles";

export function PageHeader({
  title,
  description,
  actions,
}: {
  title: string;
  description?: string;
  actions?: ReactNode;
}) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 className={pageHeadingClass}>{title}</h1>
        {description && <p className={`mt-1 ${mutedTextClass}`}>{description}</p>}
      </div>
      {actions && <div className="flex items-center gap-2">{actions}</div>}
    </div>
  );
}
