"use client";

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { OPCOS } from "@/lib/mock-data";
import { Building2 } from "lucide-react";

interface OpcoSelectorProps {
  value: string;
  onChange: (opcoId: string) => void;
}

export function OpcoSelector({ value, onChange }: OpcoSelectorProps) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
        Operating company
      </label>
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger
          aria-label="Select operating company"
          className="h-10 w-full min-w-[260px] gap-2 bg-card pl-3 text-sm font-medium shadow-sm transition-all hover:shadow-md sm:w-[300px]"
        >
          <Building2 className="size-4 shrink-0 text-[var(--brand)]" />
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="min-w-[300px]">
          {OPCOS.map((o) => (
            <SelectItem key={o.id} value={o.id} textValue={o.name} className="py-2">
              <span className="flex flex-col items-start">
                <span className="font-medium">{o.name}</span>
                <span className="text-xs text-muted-foreground">
                  {o.location}
                </span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
