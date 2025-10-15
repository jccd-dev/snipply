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
import { useAuth } from "@clerk/nextjs";

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

// API helper for PATCH
async function apiUpdateCapsule(id: string, payload: Partial<{ title: string; content: string; folderId: string | null }>) {
  const res = await fetch(`/api/capsules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { id: string };
}

export default function MarkdownEditor(): React.ReactElement {
  const active = useActiveCapsule();
  const updateCapsule = useLibraryStore((s) => s.updateCapsule);
  const isMutating = useLibraryStore((s) => s.isMutating);
  const [value, setValue] = React.useState<string>(active?.content ?? "");
  const [isDark, setIsDark] = React.useState<boolean>(false);
  const [showPreview, setShowPreview] = React.useState<boolean>(false);
  const titleDebounceRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const { isSignedIn } = useAuth();

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
    if (!isSignedIn) return; // skip autosave while signed out

    // Prevent updating capsules that were just created (race condition guard)
    const isRecentlyCreated = Date.now() - active.createdAt < 1000;
    if (isRecentlyCreated && !active.content) return;

    const t = setTimeout(() => {
      updateCapsule(active.id, { content: value });
      // persist to server (best-effort)
      apiUpdateCapsule(active.id, { content: value }).catch((err) => console.error(err));
    }, 300);
    return () => clearTimeout(t);
  }, [value, active?.id, updateCapsule, isSignedIn]);

  if (!active) {
    return (
      <div className="relative h-full">
        {isMutating && (
          <div className="absolute inset-0 bg-background/60 backdrop-blur-sm grid place-items-center" aria-live="polite" aria-busy="true">
            <div className="size-8 rounded-full border-2 border-muted border-t-transparent animate-spin" />
          </div>
        )}
        <div className="flex h-full items-center justify-center text-muted-foreground">
          Select or create a document from the right sidebar.
        </div>
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
    <div className="relative h-full p-4" aria-busy={isMutating}>
      <section className="card p-0 overflow-hidden h-full flex flex-col min-h-0">
        <div className="flex items-center justify-between border-b px-3 py-2 shrink-0 gap-2">
          <input
            value={active.title}
            onChange={(e) => {
              const next = e.target.value;
              // optimistic local update
              updateCapsule(active.id, { title: next });
              // debounce server PATCH
              if (titleDebounceRef.current) clearTimeout(titleDebounceRef.current);
              titleDebounceRef.current = setTimeout(() => {
                apiUpdateCapsule(active.id, { title: next }).catch((err) => console.error(err));
              }, 400);
            }}
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
          {isMutating && (
            <div className="absolute inset-0 bg-background/60 backdrop-blur-sm grid place-items-center" aria-live="polite">
              <div className="size-8 rounded-full border-2 border-muted border-t-transparent animate-spin" />
            </div>
          )}
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
