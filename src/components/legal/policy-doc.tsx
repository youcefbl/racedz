import { Fragment } from "react";

export type PolicySection = { id: string; title: string; body: string };

export type PolicyDocContent = {
  title: string;
  updated: string;
  intro: string;
  note: string;
  sections: readonly PolicySection[];
};

// Renders a long-form legal document (Terms / Privacy). Each section body is authored as plain
// text in the dictionary: newlines separate paragraphs, and lines starting with "• " render as
// a bullet list. A right-hand table of contents links to each section's anchor on wide screens.
export function PolicyDoc({ content }: { content: PolicyDocContent }) {
  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_15rem]">
      <div className="prose-measure order-2 space-y-8 lg:order-1">
        <div className="space-y-2">
          <p className="text-xs font-bold uppercase tracking-wide text-gray-400">{content.updated}</p>
          <p className="text-base leading-7 text-gray-700">{content.intro}</p>
          {content.note ? (
            <p className="rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-xs leading-6 text-gray-500">
              {content.note}
            </p>
          ) : null}
        </div>

        {content.sections.map((section) => (
          <section key={section.id} id={section.id} className="scroll-mt-24">
            <h2 className="text-lg font-black text-gray-950">{section.title}</h2>
            <PolicyBody body={section.body} />
          </section>
        ))}
      </div>

      <nav className="order-1 hidden self-start lg:order-2 lg:sticky lg:top-24 lg:block" aria-label="On this page">
        <ul className="space-y-1.5 border-s border-gray-200 ps-4 text-sm">
          {content.sections.map((section) => (
            <li key={section.id}>
              <a href={`#${section.id}`} className="text-gray-500 transition hover:text-brand-teal">
                {section.title}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </div>
  );
}

function PolicyBody({ body }: { body: string }) {
  const lines = body
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);

  const blocks: Array<{ type: "p"; text: string } | { type: "ul"; items: string[] }> = [];
  let bullets: string[] = [];
  const flush = () => {
    if (bullets.length) {
      blocks.push({ type: "ul", items: bullets });
      bullets = [];
    }
  };

  for (const line of lines) {
    if (line.startsWith("• ")) {
      bullets.push(line.slice(2));
    } else {
      flush();
      blocks.push({ type: "p", text: line });
    }
  }
  flush();

  return (
    <div className="mt-2 space-y-3">
      {blocks.map((block, index) => (
        <Fragment key={index}>
          {block.type === "p" ? (
            <p className="text-sm leading-7 text-gray-700">{block.text}</p>
          ) : (
            <ul className="ms-1 space-y-1.5">
              {block.items.map((item, itemIndex) => (
                <li key={itemIndex} className="flex gap-2 text-sm leading-7 text-gray-700">
                  <span className="mt-2.5 size-1.5 shrink-0 rounded-full bg-brand-teal" aria-hidden="true" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          )}
        </Fragment>
      ))}
    </div>
  );
}
