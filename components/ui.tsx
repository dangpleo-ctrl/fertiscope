import React from "react";

export function Card({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`rounded-2xl border border-white/10 bg-white/[0.03] ${className}`}>{children}</div>;
}

export function SectionLabel({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return <div className={`mb-3 text-[11px] font-semibold uppercase tracking-[0.12em] text-gray-400 ${className}`}>{children}</div>;
}

export function Caveat({ children, title = "Honest caveat" }: { children: React.ReactNode; title?: string }) {
  return (
    <div className="rounded-xl border border-amber-500/25 bg-amber-500/[0.06] p-3 text-xs leading-relaxed text-amber-200/90">
      <span className="font-semibold text-amber-300">{title}: </span>
      {children}
    </div>
  );
}

export function Deterministic() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-300">
      ● exact
    </span>
  );
}

export function Estimated() {
  return (
    <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-1.5 py-0.5 text-[10px] font-medium text-amber-300">
      ◐ estimate
    </span>
  );
}
