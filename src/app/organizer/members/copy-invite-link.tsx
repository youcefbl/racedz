"use client";

import { useEffect, useState } from "react";
import { Copy, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useOrganizerTranslation } from "@/hooks/use-organizer-translation";

export function CopyInviteLink({ path }: { path: string }) {
  const { t } = useOrganizerTranslation();
  const [link, setLink] = useState(path);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    setLink(`${window.location.origin}${path}`);
  }, [path]);

  async function copyLink() {
    await navigator.clipboard.writeText(link);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1800);
  }

  return (
    <div className="mt-3 grid gap-2 sm:grid-cols-[1fr_auto]">
      <input
        readOnly
        value={link}
        className="h-10 min-w-0 rounded-lg border border-gray-300 bg-gray-50 px-3 text-sm text-gray-700 outline-none"
        aria-label={t("Invitation link")}
      />
      <Button type="button" variant="outline" size="sm" onClick={copyLink}>
        {copied ? <Check className="size-4" aria-hidden={true} /> : <Copy className="size-4" aria-hidden={true} />}
        {copied ? t("Copied") : t("Copy")}
      </Button>
    </div>
  );
}
