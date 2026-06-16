import type { ReactNode } from "react";

type SectionPageProps = {
  eyebrow: string;
  title: string;
  children?: ReactNode;
};

export function SectionPage({ eyebrow, title, children }: SectionPageProps) {
  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="rounded-lg border border-gray-200 bg-white p-6 shadow-sm">
        <p className="text-sm font-bold text-brand-teal">{eyebrow}</p>
        <h1 className="mt-2 text-3xl font-black text-gray-950">{title}</h1>
        {children ? <div className="mt-5 text-sm leading-6 text-gray-600">{children}</div> : null}
      </div>
    </div>
  );
}
