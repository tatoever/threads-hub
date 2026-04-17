"use client";

import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";

export type AccountTabKey =
  | "overview"
  | "operations"
  | "persona"
  | "api"
  | "notes"
  | "research";

const TAB_LABELS: Record<AccountTabKey, string> = {
  overview: "概要",
  operations: "運用ビュー",
  persona: "ペルソナ",
  api: "API接続",
  notes: "誘導先ノート",
  research: "リサーチ",
};

const TAB_ORDER: AccountTabKey[] = [
  "overview",
  "operations",
  "persona",
  "api",
  "notes",
  "research",
];

export function AccountTabs({
  panels,
}: {
  panels: Record<AccountTabKey, React.ReactNode>;
}) {
  const router = useRouter();
  const params = useSearchParams();
  const initial = (params.get("tab") as AccountTabKey) || "overview";
  const [value, setValue] = React.useState<AccountTabKey>(
    TAB_ORDER.includes(initial) ? initial : "overview",
  );

  function onChange(v: string) {
    setValue(v as AccountTabKey);
    const url = new URL(window.location.href);
    if (v === "overview") url.searchParams.delete("tab");
    else url.searchParams.set("tab", v);
    router.replace(url.pathname + url.search, { scroll: false });
  }

  return (
    <Tabs value={value} onValueChange={onChange}>
      <TabsList className="h-auto flex-wrap">
        {TAB_ORDER.map((k) => (
          <TabsTrigger key={k} value={k}>
            {TAB_LABELS[k]}
          </TabsTrigger>
        ))}
      </TabsList>
      {TAB_ORDER.map((k) => (
        <TabsContent key={k} value={k}>
          {panels[k]}
        </TabsContent>
      ))}
    </Tabs>
  );
}
