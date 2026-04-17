"use client";

import * as React from "react";
import { useParams, useRouter } from "next/navigation";
import { Check, ChevronsUpDown, Plus, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { StatusDot, statusToTone } from "./StatusDot";
import { cn } from "@/lib/utils/cn";

export interface AccountOption {
  id: string;
  name: string;
  slug: string;
  status: string;
  displayName?: string | null;
  genre?: string | null;
}

export function AccountSwitcher({ accounts }: { accounts: AccountOption[] }) {
  const router = useRouter();
  const params = useParams<{ id?: string }>();
  const [open, setOpen] = React.useState(false);

  const activeId = params?.id;
  const active = React.useMemo(
    () => accounts.find((a) => a.id === activeId) ?? null,
    [accounts, activeId],
  );

  const label = active
    ? active.displayName || active.name
    : "アカウントを選択";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "w-[240px] justify-between pl-3 pr-2 gap-2 font-medium",
            "bg-surface hover:bg-surface-hover",
          )}
        >
          <span className="flex items-center gap-2 min-w-0">
            {active ? (
              <StatusDot tone={statusToTone(active.status)} />
            ) : (
              <Users className="size-4 text-muted-foreground" />
            )}
            <span className="truncate">{label}</span>
            {active?.slug && (
              <span className="truncate text-xs text-muted-foreground">
                @{active.slug}
              </span>
            )}
          </span>
          <ChevronsUpDown className="size-4 shrink-0 text-muted-foreground" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[320px] p-0">
        <Command>
          <CommandInput placeholder="アカウント検索…" />
          <CommandList>
            <CommandEmpty>該当なし</CommandEmpty>
            <CommandGroup heading="登録アカウント">
              {accounts.map((a) => {
                const selected = a.id === activeId;
                return (
                  <CommandItem
                    key={a.id}
                    value={`${a.name} ${a.displayName ?? ""} ${a.slug} ${a.genre ?? ""}`}
                    onSelect={() => {
                      router.push(`/accounts/${a.id}`);
                      setOpen(false);
                    }}
                  >
                    <StatusDot tone={statusToTone(a.status)} />
                    <div className="flex flex-col min-w-0 flex-1">
                      <span className="truncate font-medium">
                        {a.displayName || a.name}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        @{a.slug}
                        {a.genre ? ` · ${a.genre}` : ""}
                      </span>
                    </div>
                    {selected && <Check className="ml-2 size-4 text-primary" />}
                  </CommandItem>
                );
              })}
            </CommandGroup>
            <CommandSeparator />
            <CommandGroup>
              <CommandItem
                onSelect={() => {
                  router.push("/accounts/new");
                  setOpen(false);
                }}
                className="text-primary data-[selected=true]:text-primary"
              >
                <Plus className="size-4" />
                新しいアカウントを追加
              </CommandItem>
              <CommandItem
                onSelect={() => {
                  router.push("/accounts");
                  setOpen(false);
                }}
              >
                <Users className="size-4" />
                全アカウント一覧
              </CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
