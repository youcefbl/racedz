import Image from "next/image";
import Link from "next/link";
import { cn } from "@/lib/utils";

type RaceDZLogoProps = {
  className?: string;
  showWordmark?: boolean;
};

export function RaceDZLogo({ className, showWordmark = true }: RaceDZLogoProps) {
  return (
    <Link href="/" className={cn("inline-flex items-center gap-2", className)} aria-label="RaceDZ home">
      <span className="relative flex size-10 overflow-hidden rounded-lg bg-white">
        <Image src="/racedz-logo.png" alt="" fill sizes="40px" className="object-cover" priority />
      </span>
      {showWordmark ? (
        <span className="text-xl font-black tracking-normal text-gray-950">
          Race<span className="text-brand-teal">DZ</span>
        </span>
      ) : null}
    </Link>
  );
}
