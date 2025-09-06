"use client";

import * as React from "react";
import { useActiveCapsule, useLibraryStore } from "@/store/library";
import MDEditor from "@uiw/react-md-editor";
import remarkMath from "remark-math";
import rehypeKatex from "rehype-katex";
import rehypeHighlight from "rehype-highlight";
import rehypeAutolinkHeadings from "rehype-autolink-headings";
import remarkFrontmatter from "remark-frontmatter";
import katex from "katex";
import "highlight.js/styles/github-dark.css";

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

export default function MarkdownEditor(): React.ReactElement {
  const active = useActiveCapsule();
  const updateCapsule = useLibraryStore((s) => s.updateCapsule);
  const [value, setValue] = React.useState<string>(active?.content ?? "");
  const [isDark, setIsDark] = React.useState<boolean>(false);
  const [showPreview, setShowPreview] = React.useState<boolean>(false);

  // Track the current theme from the root html class so the editor follows app theme
  React.useEffect(() => {
    const root = document.documentElement;
    const update = () => setIsDark(root.classList.contains("dark"));
    update();
    const observer = new MutationObserver(update);
    observer.observe(root, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

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

  const remarkPlugins = [remarkMath, remarkFrontmatter];
  const rehypePlugins = [
    [rehypeKatex, { output: "html" }],
    [rehypeHighlight, { detect: true, ignoreMissing: true }],
    [rehypeAutolinkHeadings, { behavior: "wrap" }],
  ];

  // Custom KaTeX renderer for code nodes (per uiw docs: support custom KaTeX preview)
  const Code: React.FC<{
    inline?: boolean;
    className?: string;
    children?: React.ReactNode;
    node?: any;
  }> = ({ children = [], className, ...props }) => {
    const first = Array.isArray(children) ? (children[0] as unknown) : (children as unknown);
    const text = typeof first === "string" ? first : "";
    if (typeof text === "string" && /^\$\$(.*)\$\$/.test(text.trim())) {
      const html = katex.renderToString(text.replace(/^\$\$(.*)\$\$/, "$1"), {
        throwOnError: false,
      });
      return <code dangerouslySetInnerHTML={{ __html: html }} style={{ background: "transparent" }} />;
    }
    return <code className={className}>{children}</code>;
  };

  return (
    <div className="h-full p-4">
      <section className="card p-0 overflow-hidden h-full flex flex-col min-h-0">
        <div className="flex items-center justify-between border-b px-3 py-2 shrink-0 gap-2">
          <input
            value={active.title}
            onChange={(e) => updateCapsule(active.id, { title: e.target.value })}
            className="bg-transparent focus:outline-none text-sm font-medium w-full"
            placeholder="Document title"
            aria-label="Document title"
          />
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => setShowPreview(false)}
              className={`px-2 py-1 text-xs rounded-md border ${!showPreview ? "bg-secondary text-foreground" : "bg-background text-muted-foreground"}`}
              aria-pressed={!showPreview}
            >
              Edit
            </button>
            <button
              type="button"
              onClick={() => setShowPreview(true)}
              className={`px-2 py-1 text-xs rounded-md border ${showPreview ? "bg-secondary text-foreground" : "bg-background text-muted-foreground"}`}
              aria-pressed={showPreview}
            >
              Preview
            </button>
          </div>
        </div>
        <div
          data-color-mode={isDark ? "dark" : "light"}
          className="px-0 flex-1 min-h-0 editor-scope wmde-markdown-var"
        >
          {!showPreview ? (
            <MDEditor
              value={value}
              height="100%"
              onChange={(val) => setValue(val || "")}
              visibleDragbar={false}
              preview="edit"
              previewOptions={{
                remarkPlugins,
                rehypePlugins,
                components: { code: Code },
              }}
              textareaProps={{
                placeholder: "Write your Markdown here...",
              }}
            />
          ) : (
            <div className="h-full overflow-auto p-4" data-color-mode={isDark ? "dark" : "light"}>
              <MDEditor.Markdown
                source={value}
                remarkPlugins={remarkPlugins}
                rehypePlugins={rehypePlugins}
                components={{ code: Code }}
              />
              <MermaidInPreview content={value} />
            </div>
          )}
        </div>
      </section>
    </div>
  );
}
