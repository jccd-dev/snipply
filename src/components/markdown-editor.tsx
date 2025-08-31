"use client";

import * as React from "react";
import { useActiveCapsule, useLibraryStore } from "@/store/library";
import MDEditor from "@uiw/react-md-editor";
import rehypeSlug from "rehype-slug";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import remarkGfm from "remark-gfm";
import remarkMath from "remark-math";
import remarkFootnotes from "remark-footnotes";
import remarkToc from "remark-toc";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";

function MermaidInPreview({ content }: { content: string }) {
  React.useEffect(() => {
    (async () => {
      const mermaid = (await import("mermaid")).default;
      mermaid.initialize({ startOnLoad: false, theme: "neutral" });
      try {
        await mermaid.run({ querySelector: ".wmde-markdown pre code.language-mermaid" });
      } catch (_) {
        // ignore
      }
    })();
  }, [content]);
  return null;
}

export default function MarkdownEditor(): JSX.Element {
  const active = useActiveCapsule();
  const updateCapsule = useLibraryStore((s) => s.updateCapsule);
  const [value, setValue] = React.useState<string>(active?.content ?? "");

  React.useEffect(() => {
    setValue(active?.content ?? "");
  }, [active?.id]);

  React.useEffect(() => {
    if (!active?.id) return;
    const t = setTimeout(() => updateCapsule(active.id, { content: value }), 300);
    return () => clearTimeout(t);
  }, [value, active?.id, updateCapsule]);

  if (!active) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Select or create a document from the right sidebar.
      </div>
    );
  }

  return (
    <div className="h-full p-4">
      <section className="card p-0 overflow-hidden h-full flex flex-col min-h-0">
        <div className="flex items-center justify-between border-b px-3 py-2 shrink-0">
          <input
            value={active.title}
            onChange={(e) => updateCapsule(active.id, { title: e.target.value })}
            className="bg-transparent focus:outline-none text-sm font-medium w-full"
            placeholder="Document title"
            aria-label="Document title"
          />
        </div>
        <div data-color-mode="auto" className="px-0 flex-1 min-h-0">
          <MDEditor
            value={value}
            height="100%"
            onChange={(val) => setValue(val || "")}
            visibleDragbar={false}
            // Start in edit-only; users can toggle preview/preview-only from toolbar (eye icon)
            preview="edit"
            previewOptions={{
              remarkPlugins: [remarkGfm, remarkMath, [remarkFootnotes, { inlineNotes: true }], [remarkToc, { tight: true, ordered: false, fromHeading: 2, toHeading: 6 }]],
              rehypePlugins: [rehypeKatex, rehypeHighlight, rehypeSlug, [rehypeAutolinkHeadings, { behavior: "wrap" }]],
            }}
            textareaProps={{ placeholder: "Write your Markdown here..." }}
          />
          <MermaidInPreview content={value} />
        </div>
      </section>
    </div>
  );
}
