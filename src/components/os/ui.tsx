import { type ReactNode } from "react";

import { cn } from "@/lib/utils";

export function Panel({
  title,
  action,
  children,
  className,
}: {
  title?: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={cn("border border-border bg-card", className)}>
      {(title || action) && (
        <header className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-5 py-4">
          {title && (
            <h3 className="font-display text-xl font-bold uppercase tracking-wide">{title}</h3>
          )}
          {action}
        </header>
      )}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Stat({ label, value, hint }: { label: string; value: string; hint?: string }) {
  return (
    <div className="border border-border bg-card p-5">
      <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-primary">{label}</p>
      <p className="mt-3 font-display text-4xl font-black leading-none">{value}</p>
      {hint && <p className="mt-2 text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}

export function TabBar<T extends string>({
  tabs,
  active,
  onChange,
}: {
  tabs: readonly { id: T; label: string }[];
  active: T;
  onChange: (id: T) => void;
}) {
  return (
    <div className="-mx-5 overflow-x-auto px-5 lg:mx-0 lg:px-0">
      <div className="flex min-w-max gap-1 border-b border-border" role="tablist">
        {tabs.map((t) => (
          <button
            key={t.id}
            role="tab"
            aria-selected={active === t.id}
            onClick={() => onChange(t.id)}
            className={cn(
              "border-b-2 px-4 py-3 text-[11px] font-bold uppercase tracking-[0.16em] transition-colors",
              active === t.id
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block text-[10px] font-bold uppercase tracking-[0.18em] text-muted-foreground">
      {label}
      <div className="mt-2 font-normal normal-case tracking-normal text-foreground">{children}</div>
    </label>
  );
}

export const inputClass =
  "h-11 w-full rounded-none border border-border bg-background px-3 text-sm text-foreground outline-none focus:border-primary";

export function Table({ head, children }: { head: string[]; children: ReactNode }) {
  return (
    <div className="-mx-5 overflow-x-auto px-5">
      <table className="w-full min-w-[520px] border-collapse text-sm">
        <thead>
          <tr className="border-b border-border text-left">
            {head.map((h) => (
              <th
                key={h}
                className="whitespace-nowrap py-3 pr-4 text-[10px] font-bold uppercase tracking-[0.16em] text-muted-foreground"
              >
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

export function Empty({ text }: { text: string }) {
  return <p className="py-8 text-center text-sm text-muted-foreground">{text}</p>;
}

export function Loading() {
  return <p className="py-8 text-center text-sm text-muted-foreground">Loading…</p>;
}

export function Disclaimer({ children }: { children: ReactNode }) {
  return (
    <p className="border-l-2 border-primary/60 bg-primary/5 p-4 text-xs leading-5 text-muted-foreground">
      {children}
    </p>
  );
}
