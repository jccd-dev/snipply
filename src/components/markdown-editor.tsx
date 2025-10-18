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
import { useQueryClient } from "@tanstack/react-query";

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

type CapsuleDto = {
  id: string;
  title: string;
  content: string;
  folderId: string | null;
  createdAt: string;
  updatedAt: string;
};

function isAbortError(err: unknown): boolean {
  // Normalize detection across runtimes
  // - DOMException with name AbortError
  // - Error message contains "aborted"
  // - string reasons passed to AbortController.abort(reason)
  // - legacy DOMException code 20 (ABORT_ERR)
  if (typeof err === "string") return true;
  const anyErr = err as { name?: string; message?: string; code?: number; cause?: unknown } | undefined;
  if (!anyErr) return false;
  if (anyErr.name === "AbortError") return true;
  if ((anyErr.message ?? "").toLowerCase().includes("abort")) return true;
  if (anyErr.code === 20) return true;
  const cause = anyErr.cause as { name?: string; message?: string } | undefined;
  if (cause?.name === "AbortError") return true;
  if ((cause?.message ?? "").toLowerCase().includes("abort")) return true;
  return false;
}

// API helper for PATCH (supports cancel via AbortController)
async function apiUpdateCapsule(
  id: string,
  payload: Partial<{ title: string; content: string; folderId: string | null }>,
  signal?: AbortSignal,
) {
  const res = await fetch(`/api/capsules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
    signal,
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as CapsuleDto;
}

// API helper for POST (create capsule)
async function apiCreateCapsule(payload: { title?: string; content?: string; folderId?: string | null }) {
  const res = await fetch(`/api/capsules`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
    cache: "no-store",
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as CapsuleDto;
}

export default function MarkdownEditor(): React.ReactElement {
  const active = useActiveCapsule();
  const updateCapsule = useLibraryStore((s) => s.updateCapsule);
  const commitCapsuleId = useLibraryStore((s) => s.commitCapsuleId);
  const isMutating = useLibraryStore((s) => s.isMutating);
  const [value, setValue] = React.useState<string>(active?.content ?? "");
  const [title, setTitle] = React.useState<string>(active?.title ?? "");
  const [savedTitle, setSavedTitle] = React.useState<string>(active?.title ?? "");
  const [savedContent, setSavedContent] = React.useState<string>(active?.content ?? "");
  const [isDark, setIsDark] = React.useState<boolean>(false);
  const [showPreview, setShowPreview] = React.useState<boolean>(false);
  const autosaveTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  const autosaveAbortRef = React.useRef<AbortController | null>(null);
  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  const isDirty = title !== savedTitle || value !== savedContent;
  const setSavedSnapshot = (t: string, c: string) => {
    setSavedTitle(t);
    setSavedContent(c);
  };

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
    setTitle(active?.title ?? "");
    setSavedSnapshot(active?.title ?? "", active?.content ?? "");
  }, [active?.id]);

  // Soft autosave: local-first update, debounced server patch, cancelable
  React.useEffect(() => {
    if (!active?.id) return;
    if (!isSignedIn) return;

    // Always keep local store in sync while typing
    updateCapsule(active.id, { title, content: value });

    // Cancel previous autosave
    if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
    if (autosaveAbortRef.current && !autosaveAbortRef.current.signal.aborted) autosaveAbortRef.current.abort();

    // Only server-save for real ids and when there are changes
    if (active.id.startsWith("cap_")) return;
    if (!isDirty) return;

    autosaveTimerRef.current = setTimeout(async () => {
      try {
        autosaveAbortRef.current = new AbortController();
        const payload: Partial<{ title: string; content: string }> = {};
        if (title !== savedTitle) payload.title = title;
        if (value !== savedContent) payload.content = value;
        if (Object.keys(payload).length === 0) return;

        // Mark saving
        // Update status via attribute on container (we keep UI minimal for now)
        const updated = await apiUpdateCapsule(active.id, payload, autosaveAbortRef.current.signal);

        // Update cache immediately
        queryClient.setQueryData<{ folders: any[]; capsules: CapsuleDto[] }>(["library"], (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            capsules: prev.capsules.map((c) => (c.id === updated.id ? { ...c, title: updated.title, content: updated.content, updatedAt: updated.updatedAt } : c)),
          };
        });

        // Snapshot saved values
        setSavedSnapshot(title, value);
      } catch (err) {
        if (!isAbortError(err)) console.error("Autosave error", err);
      }
    }, 1500);

    return () => {
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (autosaveAbortRef.current && !autosaveAbortRef.current.signal.aborted) autosaveAbortRef.current.abort();
    };
  }, [title, value, active?.id, isSignedIn, isDirty, updateCapsule, savedTitle, savedContent, queryClient]);

  // Save handler (explicit commit)
  const handleSave = React.useCallback(async () => {
    if (!active) return;
    try {
      // Cancel pending autosave
      if (autosaveTimerRef.current) clearTimeout(autosaveTimerRef.current);
      if (autosaveAbortRef.current && !autosaveAbortRef.current.signal.aborted) autosaveAbortRef.current.abort();

      const payload: Partial<{ title: string; content: string }> = {};
      if (title !== savedTitle) payload.title = title;
      if (value !== savedContent) payload.content = value;
      if (Object.keys(payload).length === 0) return; // nothing to save

      if (active.id.startsWith("cap_")) {
        // Create and commit new id
        const created = await apiCreateCapsule({ title, content: value, folderId: active.folderId ?? null });

        // Update store: replace temp id with server id
        commitCapsuleId(active.id, created.id);
        updateCapsule(created.id, { title: created.title, content: created.content, folderId: created.folderId ?? null });

        // Update query cache
        queryClient.setQueryData<{ folders: any[]; capsules: CapsuleDto[] }>(["library"], (prev) => {
          if (!prev) return prev;
          const found = prev.capsules.find((c) => c.id === created.id);
          return {
            ...prev,
            capsules: found ? prev.capsules.map((c) => (c.id === created.id ? created : c)) : [created, ...prev.capsules],
          };
        });

        setSavedSnapshot(created.title, created.content);
      } else {
        const updated = await apiUpdateCapsule(active.id, payload);

        // Update query cache
        queryClient.setQueryData<{ folders: any[]; capsules: CapsuleDto[] }>(["library"], (prev) => {
          if (!prev) return prev;
          return {
            ...prev,
            capsules: prev.capsules.map((c) => (c.id === updated.id ? { ...c, title: updated.title, content: updated.content, updatedAt: updated.updatedAt } : c)),
          };
        });

        setSavedSnapshot(title, value);
      }
    } catch (err) {
      if (!isAbortError(err)) console.error("Save error", err);
    }
  }, [active, title, savedTitle, value, savedContent, commitCapsuleId, updateCapsule, queryClient]);

  // Cancel handler (revert to last saved snapshot)
  const handleCancel = React.useCallback(() => {
    if (!active) return;
    setTitle(savedTitle);
    setValue(savedContent);
    updateCapsule(active.id, { title: savedTitle, content: savedContent });
  }, [active, savedTitle, savedContent, updateCapsule]);

  // Ctrl+S shortcut
  const handleSaveRef = React.useRef<() => void>(() => {});
  React.useEffect(() => {
    handleSaveRef.current = () => {
      void handleSave();
    };
  }, [handleSave]);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const isMac = navigator.platform.toUpperCase().includes("MAC");
      const ctrlOrCmd = isMac ? e.metaKey : e.ctrlKey;
      if (ctrlOrCmd && e.key.toLowerCase() === "s") {
        e.preventDefault();
        handleSaveRef.current();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

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
            value={title}
            onChange={(e) => {
              const next = e.target.value;
              setTitle(next);
              // local store update handled by autosave effect
            }}
            onBlur={() => {
              // save on blur if there are changes
              if (isDirty) void handleSave();
            }}
            className="bg-transparent focus:outline-none text-sm font-medium w-full"
            placeholder="Document title"
            aria-label="Document title"
          />
          <div className="flex items-center gap-2">
            {isDirty ? (
              <span className="text-xs text-amber-600 text-nowrap">Unsaved changes</span>
            ) : (
              <span className="text-xs text-muted-foreground">Saved</span>
            )}
            <button
              type="button"
              onClick={handleSave}
              className="px-2 py-1 text-xs rounded-md border bg-background hover:bg-secondary text-foreground"
            >
              Save
            </button>
            <button
              type="button"
              onClick={handleCancel}
              className="px-2 py-1 text-xs rounded-md border bg-background hover:bg-secondary text-foreground"
            >
              Cancel
            </button>
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
                onBlur: () => {
                  if (isDirty) void handleSave();
                },
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
