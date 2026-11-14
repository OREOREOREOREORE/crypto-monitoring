import type { ReactNode } from "react";
import { DragHandle } from "./DragHandle";

interface Props {
  title: string;
  children: ReactNode;
  actions?: ReactNode;
}

export function Widget({ title, children, actions }: Props) {
  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-zinc-800 bg-zinc-900">
      <div className="flex shrink-0 items-center justify-between border-b border-zinc-800 px-3 py-2">
        <div className="flex items-center gap-2">
          <DragHandle />
          <h2 className="text-sm font-semibold text-zinc-300">{title}</h2>
        </div>
        {actions}
      </div>
      <div className="min-h-0 flex-1">{children}</div>
    </div>
  );
}
