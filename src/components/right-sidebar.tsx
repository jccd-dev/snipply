"use client";

import * as React from "react";
import { useLibraryStore, type Folder } from "@/store/library";
import { FolderIcon, CaretRightIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { pickColorDeterministic } from "@/theme/palette";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

// API helpers
async function apiCreateCapsule(payload: { title?: string; content?: string; folderId?: string | null }) {
  const res = await fetch("/api/capsules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { id: string; title: string; folderId: string | null; content: string };
}

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

// Folder API helpers
async function apiCreateFolder(payload: { id?: string; name?: string }) {
  const res = await fetch("/api/folders", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { id: string; name: string; createdAt: string };
}

async function apiUpdateFolder(id: string, payload: { name?: string }) {
  const res = await fetch(`/api/folders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { id: string; name: string };
}

// New: DELETE API helpers
async function apiDeleteCapsule(id: string) {
  const res = await fetch(`/api/capsules/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { id: string };
}

async function apiDeleteFolder(id: string) {
  const res = await fetch(`/api/folders/${id}`, { method: "DELETE", credentials: "include" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { id: string };
}

// FolderItem component
function FolderItem({ folder }: { folder: Folder }): React.ReactElement {
  // Optimize store subscriptions - use selective subscriptions for better re-render performance
  const renameFolder = useLibraryStore((s) => s.renameFolder);
  const capsules = useLibraryStore((s) => s.capsules);
  const moveCapsuleToFolder = useLibraryStore((s) => s.moveCapsuleToFolder);
  const setActiveCapsule = useLibraryStore((s) => s.setActiveCapsule);
  const removeCapsule = useLibraryStore((s) => s.removeCapsule);
  const removeFolder = useLibraryStore((s) => s.removeFolder);
  const beginMutation = useLibraryStore((s) => s.beginMutation);
  const endMutation = useLibraryStore((s) => s.endMutation);

  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(folder.name);
  const [isDragOver, setIsDragOver] = React.useState(false);

  // Access TanStack Query client at the component level per hooks rules
  const queryClient = useQueryClient();
  const updateCapsuleFolderMutation = useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string }) => apiUpdateCapsule(id, { folderId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });

  const deleteCapsuleMutation = useMutation({
    mutationFn: (id: string) => apiDeleteCapsule(id),
    onSettled: () => queryClient.invalidateQueries({
      queryKey: ['library']
    })
  })
  const [open, setOpen] = React.useState(true);

  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    // Stop event bubbling immediately so the sidebar's onDrop doesn't also fire
    e.stopPropagation();
    setIsDragOver(false);
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const prevFolder = capsules.find((c) => c.id === id)?.folderId ?? null;
    if (prevFolder === folder.id) {
      // dropped into same folder, no-op
      return;
    }
    beginMutation();
    moveCapsuleToFolder(id, folder.id);
    setOpen(true);
    const isTemp = id.startsWith("cap_");
    if (isTemp) {
      endMutation();
      return;
    }
    try {
      await updateCapsuleFolderMutation.mutateAsync({ id, folderId: folder.id });
    } catch (err) {
      console.error(err);
      // rollback
      moveCapsuleToFolder(id, prevFolder);
    } finally {
      endMutation();
    }
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const onDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear drag over if we're actually leaving the folder container
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
    }
  };

  const items = capsules.filter((c) => c.folderId === folder.id);

  // Use folder hex color directly via CSS custom property
  const folderStyle = { ["--folder-accent" as any]: folder.color } as React.CSSProperties;

  return (
    <div
      className={[
        "card w-full px-2 pt-2 pb-1 overflow-hidden transition-all duration-200",
        isDragOver ? "ring-2 ring-blue-400 bg-blue-50/50 dark:bg-blue-950/20" : ""
      ].join(" ")}
      style={{ ...folderStyle, borderColor: "var(--folder-accent)" }}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      aria-label={`Folder ${folder.name}`}
      aria-expanded={open}
    >
      <div className="flex items-center gap-2 mb-1.5 min-w-0">
        <button
          type="button"
          aria-label={open ? "Collapse folder" : "Expand folder"}
          onClick={() => setOpen((v) => !v)}
          className="size-6 grid place-items-center rounded-md hover:bg-muted shrink-0"
        >
          <CaretRightIcon size={14} className={["smooth", open ? "rotate-90" : "rotate-0"].join(" ")} />
        </button>
        <span className="inline-flex items-center gap-1.5 shrink-0">
          <FolderIcon size={16} weight="fill" style={{ color: "var(--folder-accent)" }} />
        </span>
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={async () => {
              const newName = name.trim() || "New Folder";
              const prev = folder.name;
              // optimistic update
              renameFolder(folder.id, newName);
              try {
                const updateFolder = (id: string, name?: string) => apiUpdateFolder(id, { name });
                // Use TanStack mutation ad-hoc
                await (async () => {
                  const res = await updateFolder(folder.id, newName);
                  // Invalidate library cache to keep server-state aligned
                  queryClient.invalidateQueries({ queryKey: ["library"] });
                  return res;
                })();
              } catch (err) {
                console.error(err);
                // rollback on failure
                renameFolder(folder.id, prev);
              } finally {
                setEditing(false);
              }
            }}
            className="bg-transparent focus:outline-none text-sm font-medium truncate min-w-0 flex-1"
            autoFocus
          />
        ) : (
          <button className="text-left text-sm font-medium truncate min-w-0 flex-1" onClick={() => setEditing(true)}>
            {folder.name}
          </button>
        )}
        {/* Delete folder button */}
        <button
          aria-label="Delete folder"
          title="Delete folder"
          className="size-6 grid place-items-center rounded-md hover:bg-muted text-red-500"
          onClick={async (e) => {
            e.stopPropagation();
            const prevFolders = useLibraryStore.getState().folders;
            const prevCaps = useLibraryStore.getState().capsules;
            // optimistic remove: also detaches capsule.folderId via store logic
            removeFolder(folder.id);
            try {
              // Use TanStack mutation ad-hoc
              const res = await apiDeleteFolder(folder.id);
              queryClient.invalidateQueries({ queryKey: ["library"] });
              void res;
            } catch (err) {
              console.error(err);
              // rollback
              useLibraryStore.setState({ folders: prevFolders, capsules: prevCaps });
            }
          }}
        >
          <TrashIcon size={14} />
        </button>
        {/* Removed manual color selectors for consistent automatic palette */}
      </div>
      {open && (
        <div className="flex flex-col gap-1">
          {items.map((c) => {
            const capColor = c.color ?? folder.color; // store ensures equality, fallback safe
            const capStyle = capColor ? ({ ["--cap-accent" as any]: capColor } as React.CSSProperties) : undefined;
            return (
              <div key={c.id} className={["group/cap relative"].join(" ")}>
                <button
                  className={["cap-item w-full text-left pr-20 text-xs"].join(" ")}
                  style={capStyle}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                  onClick={() => setActiveCapsule(c.id)}
                >
                  <span className="flex items-center gap-2 min-w-0 w-full">
                    {capColor && (
                      <span className="size-2 rounded-full shrink-0" style={{ background: "var(--cap-accent)" }} />
                    )}
                     <span className="truncate min-w-0 flex-1" title={c.title || "Untitled"}>
                       {c.title || "Untitled"}
                     </span>
                  </span>
                </button>
                {/* Delete capsule button (appears on hover) */}
                <button
                  aria-label="Delete doc"
                  title="Delete doc"
                  className="absolute right-1 top-1 opacity-0 group-hover/cap:opacity-100 transition size-6 grid place-items-center rounded-md hover:bg-muted text-red-500"
                  onClick={async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const prevCaps = useLibraryStore.getState().capsules;
                    beginMutation();
                    removeCapsule(c.id);
                    try {
                      await deleteCapsuleMutation.mutateAsync(c.id);
                    } catch (err) {
                      console.error(err);
                      useLibraryStore.setState({ capsules: prevCaps });
                    } finally {
                      endMutation();
                    }
                  }}
                >
                  <TrashIcon size={12} />
                </button>
              </div>
            );
          })}
          {items.length === 0 && (
            <div className="text-xs text-muted-foreground px-3 py-2">Drop docs here</div>
          )}
        </div>
      )}
    </div>
  );
}

function OrphanList(): React.ReactElement | null {
  // Optimize store subscriptions - use selective subscriptions for better re-render performance
  const capsules = useLibraryStore((s) => s.capsules);
  const moveCapsuleToFolder = useLibraryStore((s) => s.moveCapsuleToFolder);
  const setActiveCapsule = useLibraryStore((s) => s.setActiveCapsule);
  const beginMutation = useLibraryStore((s) => s.beginMutation);
  const endMutation = useLibraryStore((s) => s.endMutation);

  const queryClient = useQueryClient();
  // Add a mutation for moving capsules to uncategorized (sidebar drop)
  const updateCapsuleFolderMutation = useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) =>
      apiUpdateCapsule(id, { folderId }),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });
  const deleteCapsuleMutation = useMutation({
    mutationFn: (id: string) => apiDeleteCapsule(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });
  const items = capsules.filter((c) => c.folderId === null);

  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    // Prevent bubbling to the sidebar to avoid duplicate handlers
    e.stopPropagation();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const prevFolder = capsules.find((c) => c.id === id)?.folderId ?? null;
    beginMutation();
    moveCapsuleToFolder(id, null);
    const isTemp = id.startsWith("cap_");
    if (isTemp) {
      endMutation();
      return;
    }
    try {
      await updateCapsuleFolderMutation.mutateAsync({ id, folderId: null });
    } catch (err) {
      console.error(err);
      moveCapsuleToFolder(id, prevFolder);
    } finally {
      endMutation();
    }
  };

  if (items.length === 0) return null;

  return (
    <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} aria-label="Documents">
      <div className="flex flex-col gap-1">
        {items.map((c) => {
          const capColor = c.color; // unsorted should be null -> no accent
          const capStyle = capColor ? ({ ["--cap-accent" as any]: capColor } as React.CSSProperties) : undefined;
          return (
            <div key={c.id} className={["group/cap relative"].join(" ")}>
              <button
                className={["cap-item w-full text-left pr-20 text-xs"].join(" ")}
                style={capStyle}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
                onClick={() => setActiveCapsule(c.id)}
              >
                <span className="flex items-center gap-2 min-w-0 w-full">
                  {capColor && (
                    <span className="size-2 rounded-full shrink-0" style={{ background: "var(--cap-accent)" }} />
                  )}
                  <span className="truncate min-w-0 flex-1" title={c.title || "Untitled"}>
                    {c.title || "Untitled"}
                  </span>
                </span>
                </button>
                {/* Delete capsule button (appears on hover) for orphan docs */}
                <button
                  aria-label="Delete doc"
                  title="Delete doc"
                  className="absolute right-1 top-1 opacity-0 group-hover/cap:opacity-100 transition size-6 grid place-items-center rounded-md hover:bg-muted text-red-500"
                  onClick={async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const prevCaps = useLibraryStore.getState().capsules;
                    useLibraryStore.getState().removeCapsule(c.id);
                    try {
                      await apiDeleteCapsule(c.id);
                    } catch (err) {
                      console.error(err);
                      useLibraryStore.setState({ capsules: prevCaps });
                    }
                  }}
                >
                  <TrashIcon size={12} />
                </button>
                {/* Delete capsule button (appears on hover) for orphan docs */}
                <button
                  aria-label="Delete doc"
                  title="Delete doc"
                  className="absolute right-1 top-1 opacity-0 group-hover/cap:opacity-100 transition size-6 grid place-items-center rounded-md hover:bg-muted text-red-500"
                  onClick={async (e) => {
                    e.stopPropagation();
                    e.preventDefault();
                    const prevCaps = useLibraryStore.getState().capsules;
                    beginMutation();
                    useLibraryStore.getState().removeCapsule(c.id);
                    try {
                      await deleteCapsuleMutation.mutateAsync(c.id);
                    } catch (err) {
                      console.error(err);
                      useLibraryStore.setState({ capsules: prevCaps });
                    } finally {
                      endMutation();
                    }
                  }}
                >
                  <TrashIcon size={12} />
                </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// RightSidebar component
export default function RightSidebar(): React.ReactElement {
  // Optimize store subscriptions - use selective subscriptions for better re-render performance
  const folders = useLibraryStore((s) => s.folders);
  const capsules = useLibraryStore((s) => s.capsules);
  const addFolder = useLibraryStore((s) => s.addFolder);
  const addCapsule = useLibraryStore((s) => s.addCapsule);
  const moveCapsuleToFolder = useLibraryStore((s) => s.moveCapsuleToFolder);
  const setActiveCapsule = useLibraryStore((s) => s.setActiveCapsule);
  const removeCapsule = useLibraryStore((s) => s.removeCapsule);
  const removeFolder = useLibraryStore((s) => s.removeFolder);
  const commitCapsuleId = useLibraryStore((s) => s.commitCapsuleId);
  const beginMutation = useLibraryStore((s) => s.beginMutation);
  const endMutation = useLibraryStore((s) => s.endMutation);

  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  // Initial server data hydration (once)
  const hydratedRef = React.useRef(false);
  const looksEmpty = folders.length === 0 || (capsules.length === 1 && (capsules[0]?.title ?? "") === "Getting Started");
  const libraryQuery = useQuery({
    queryKey: ["library"],
    enabled: isSignedIn && !hydratedRef.current && looksEmpty,
    queryFn: async () => {
      const res = await fetch("/api/library", { cache: "no-store", credentials: "include" });
      if (res.status === 401) return { folders: [], capsules: [] } as const;
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { folders: Array<{ id: string; name: string; createdAt: string }>; capsules: Array<{ id: string; title: string; content: string; folderId: string | null; createdAt: string; updatedAt: string }> };
    },
  });
  React.useEffect(() => {
    if (!libraryQuery.data || hydratedRef.current) return;
    const serverFolders: Folder[] = libraryQuery.data.folders.map((f) => ({ id: f.id, name: f.name, createdAt: new Date(f.createdAt).getTime(), color: pickColorDeterministic(f.id) }));
    const serverCapsules = libraryQuery.data.capsules.map((c) => ({ id: c.id, title: c.title, folderId: c.folderId, content: c.content, createdAt: new Date(c.createdAt).getTime(), updatedAt: new Date(c.updatedAt).getTime(), color: c.folderId ? pickColorDeterministic(c.folderId) : null }));
    useLibraryStore.setState({ folders: serverFolders, capsules: serverCapsules, activeCapsuleId: serverCapsules[0]?.id ?? null });
    hydratedRef.current = true;
  }, [libraryQuery.data]);

  const createCapsuleMutation = useMutation({
    mutationFn: apiCreateCapsule,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });
  const createFolderMutation = useMutation({
    mutationFn: apiCreateFolder,
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });

  const onSidebarDrop: React.DragEventHandler<HTMLElement> = async (e) => {
    e.preventDefault();
    // Ensure the drop does not bubble further
    e.stopPropagation();
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const prevFolder = capsules.find((c) => c.id === id)?.folderId ?? null;
    // Dropping on the sidebar background removes the folder association (uncategorized)
    beginMutation();
    moveCapsuleToFolder(id, null);
    const isTemp = id.startsWith("cap_");
    if (isTemp) {
      endMutation();
      return;
    }
    try {
      await apiUpdateCapsule(id, { folderId: null });
    } catch (err) {
      console.error(err);
      moveCapsuleToFolder(id, prevFolder);
    } finally {
      endMutation();
    }
  };

  return (
    <aside
      className="w-full border-l border-border bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-[calc(100vh-56px)] sticky top-14 p-3 space-y-3 overflow-y-auto overflow-x-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onSidebarDrop}
    >
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold">Library</div>
        <div className="ms-auto flex gap-1.5">
          <button
            className="size-8 grid place-items-center rounded-md hover:bg-muted"
            aria-label="New Doc"
            title="New Doc"
            onClick={async () => {
              const tempId = addCapsule("Untitled", null);
              beginMutation();
              try {
                const created = await createCapsuleMutation.mutateAsync({ title: "Untitled", folderId: null });
                commitCapsuleId(tempId, created.id);
                setActiveCapsule(created.id);
                const cur = useLibraryStore.getState().capsules.find((cap) => cap.id === created.id);
                if (cur?.folderId) {
                  try {
                    await apiUpdateCapsule(created.id, { folderId: cur.folderId });
                  } catch (e) {
                    console.error(e);
                  }
                }
              } catch (err) {
                console.error(err);
                removeCapsule(tempId);
              } finally {
                endMutation();
              }
            }}
          >
            <PlusIcon size={16} />
          </button>
          <button
            className="size-8 grid place-items-center rounded-md hover:bg-muted"
            aria-label="New Folder"
            title="New Folder"
            onClick={async () => {
              const tempId = addFolder("New Folder");
              try {
                await createFolderMutation.mutateAsync({ id: tempId, name: "New Folder" });
              } catch (err) {
                console.error(err);
                removeFolder(tempId);
              }
            }}
          >
            <FolderIcon size={16} weight="fill" />
          </button>
        </div>
      </div>
      <div className="grid gap-3">
        {folders.map((f) => (
          <FolderItem key={f.id} folder={f} />
        ))}
        {folders.length === 0 && (
          <div className="text-xs text-muted-foreground">Create a folder to organize your docs.</div>
        )}
      </div>
      <OrphanList />
    </aside>
  );
}
