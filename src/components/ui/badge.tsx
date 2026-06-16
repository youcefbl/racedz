import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const variants = {
  default: "bg-gray-100 text-gray-700",
  teal: "bg-teal-50 text-brand-teal",
  orange: "bg-orange-50 text-brand-orangeDark",
  green: "bg-green-50 text-green-700",
  red: "bg-red-50 text-red-700",
  blue: "bg-blue-50 text-blue-700"
};

type BadgeProps = HTMLAttributes<HTMLSpanElement> & {
  variant?: keyof typeof variants;
};

export function Badge({ className, variant = "default", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-md px-2 py-1 text-xs font-semibold",
        variants[variant],
        className
      )}
      {...props}
    />
  );
}
