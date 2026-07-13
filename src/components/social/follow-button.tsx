"use client";

import { UserCheck, UserPlus } from "lucide-react";
import { useState, useTransition } from "react";
import type { CoachLocale } from "@/components/coach/types";
import { cn } from "@/lib/utils";

const copy = {
  en: { follow: "Follow", following: "Following" },
  fr: { follow: "Suivre", following: "Suivi" },
  ar: { follow: "متابعة", following: "تتابعه" }
} as const;

// Self-toggling follow control. Optimistic: flips immediately, reverts on failure.
export function FollowButton({
  userId,
  initialFollowing,
  locale,
  size = "sm"
}: {
  userId: string;
  initialFollowing: boolean;
  locale: CoachLocale;
  size?: "sm" | "md";
}) {
  const t = copy[locale];
  const [following, setFollowing] = useState(initialFollowing);
  const [pending, startTransition] = useTransition();

  const toggle = () => {
    const next = !following;
    setFollowing(next); // optimistic
    startTransition(async () => {
      try {
        const res = await fetch("/api/social/follow", {
          method: "POST",
          headers: { "content-type": "application/json" },
          body: JSON.stringify({ userId })
        });
        const json = (await res.json().catch(() => null)) as { data?: { following: boolean } } | null;
        if (json?.data) setFollowing(json.data.following);
        else setFollowing(!next); // revert
      } catch {
        setFollowing(!next); // revert
      }
    });
  };

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={pending}
      aria-pressed={following}
      className={cn(
        "inline-flex shrink-0 items-center gap-1.5 rounded-full font-black transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-teal disabled:opacity-60",
        size === "sm" ? "px-3 py-1.5 text-xs" : "min-h-11 px-4 text-sm",
        following
          ? "border border-gray-200 bg-white text-gray-600 hover:border-gray-300"
          : "bg-brand-teal text-white hover:bg-teal-600"
      )}
    >
      {following ? <UserCheck className="size-4" aria-hidden="true" /> : <UserPlus className="size-4" aria-hidden="true" />}
      {following ? t.following : t.follow}
    </button>
  );
}
