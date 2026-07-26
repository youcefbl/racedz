"use client";

import { useTransition } from "react";
import { Button } from "@/components/ui/button";
import { clearAllClientErrorsAction } from "./actions";

export function ClearAllButton({ disabled }: { disabled?: boolean }) {
  const [pending, startTransition] = useTransition();

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={disabled || pending}
      onClick={() => {
        if (!window.confirm("Delete every client error report? This can't be undone.")) return;
        startTransition(() => void clearAllClientErrorsAction());
      }}
    >
      Clear all
    </Button>
  );
}
