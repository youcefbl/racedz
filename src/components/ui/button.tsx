import Link from "next/link";
import type { AnchorHTMLAttributes, ButtonHTMLAttributes, ReactNode } from "react";
import { cn } from "@/lib/utils";

const variants = {
  primary: "bg-brand-orange text-[#18001c] hover:bg-brand-orangeDark focus-visible:ring-brand-orange",
  secondary: "bg-brand-teal text-white hover:bg-brand-tealDark focus-visible:ring-brand-teal",
  // outline/ghost carry no ring colour of their own, so they'd fall back to Tailwind's default
  // blue — off-brand and inconsistent with the filled variants. Pin them to brand-teal.
  outline:
    "border border-gray-300 bg-white text-gray-900 hover:border-brand-teal hover:text-brand-teal focus-visible:ring-brand-teal",
  ghost: "text-gray-700 hover:bg-gray-100 focus-visible:ring-brand-teal",
  danger: "bg-red-600 text-white hover:bg-red-700 focus-visible:ring-red-600"
};

// Touch targets: `sm` is used for row/card actions on mobile, so it can't sit below the 44px
// guideline on a touch device. Keep the compact 36px box where a real pointer is driving
// (dense tables read better), and expand it to 44px on coarse pointers only.
const sizes = {
  sm: "h-9 px-3 text-sm [@media(pointer:coarse)]:h-11",
  md: "h-11 px-4 text-sm",
  lg: "h-12 px-5 text-base"
};

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

type ButtonLinkProps = AnchorHTMLAttributes<HTMLAnchorElement> & {
  href: string;
  children: ReactNode;
  variant?: keyof typeof variants;
  size?: keyof typeof sizes;
};

export function Button({ className, variant = "primary", size = "md", ...props }: ButtonProps) {
  return (
    <button
      className={cn(
        "inline-flex max-w-full items-center justify-center gap-2 rounded-lg text-center font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}

export function ButtonLink({ className, variant = "primary", size = "md", ...props }: ButtonLinkProps) {
  return (
    <Link
      className={cn(
        "inline-flex max-w-full items-center justify-center gap-2 rounded-lg text-center font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2",
        variants[variant],
        sizes[size],
        className
      )}
      {...props}
    />
  );
}
