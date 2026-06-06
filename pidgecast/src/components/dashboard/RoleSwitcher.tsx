"use client";

import { cn } from "@/lib/utils";
import { ROLES, ROLE_CONFIG } from "@/lib/config";
import type { Role } from "@/lib/types";

interface RoleSwitcherProps {
  value: Role;
  onChange: (role: Role) => void;
}

export function RoleSwitcher({ value, onChange }: RoleSwitcherProps) {
  return (
    <div
      role="tablist"
      aria-label="Select role view"
      className="flex w-full items-center gap-1 overflow-x-auto rounded-xl border bg-muted/50 p-1 shadow-sm [scrollbar-width:none] sm:w-auto [&::-webkit-scrollbar]:hidden"
    >
      {ROLES.map((role) => {
        const active = role === value;
        return (
          <button
            key={role}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(role)}
            className={cn(
              "shrink-0 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-semibold transition-all duration-200 active:translate-y-px",
              active
                ? "bg-[var(--brand)] text-[var(--brand-foreground)] shadow-sm"
                : "text-muted-foreground hover:bg-card hover:text-foreground hover:shadow-sm"
            )}
          >
            {ROLE_CONFIG[role].label}
          </button>
        );
      })}
    </div>
  );
}
