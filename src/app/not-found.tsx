import { Compass } from "lucide-react";
import { ButtonLink } from "@/components/ui/button";

// App-wide 404. Without this, a notFound() falls through to Next's bare default page, which
// drops the site shell entirely.
export default function NotFound() {
  return (
    <div className="mx-auto flex max-w-2xl flex-col items-center px-4 py-20 text-center sm:px-6">
      <div className="mb-4 flex size-12 items-center justify-center rounded-full bg-teal-50 text-brand-teal">
        <Compass className="size-6" aria-hidden={true} />
      </div>
      <h1 className="text-xl font-black text-gray-950">Page not found</h1>
      <p className="mx-auto mt-2 max-w-md text-sm leading-6 text-gray-600">
        The page you&rsquo;re looking for doesn&rsquo;t exist or has moved.
      </p>
      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <ButtonLink href="/races" variant="secondary">
          Browse races
        </ButtonLink>
        <ButtonLink href="/" variant="outline">
          Go home
        </ButtonLink>
      </div>
    </div>
  );
}
