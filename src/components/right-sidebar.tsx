"use client";

import * as React from "react";
import { useLibraryStore, type Folder } from "@/store/library";
import { FolderIcon, CaretRightIcon, PlusIcon, TrashIcon, ArrowClockwiseIcon } from "@phosphor-icons/react";
import { pickColorDeterministic } from "@/theme/palette";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";

function isNetworkError(err: unknown): boolean {
  return err instanceof TypeError || (typeof err === "string" && err.toLowerCase().includes("failed to fetch"));
}

// API helpers
async function apiCreateCapsule(payload: { title?: string; content?: string; folderId?: string | null }) {
  const res = await fetch("/api/capsules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
    credentials: "include",
    cache: "no-store",
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
    cache: "no-store",
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
  // Treat 204 and 404 as success to keep UI consistent for optimistic deletions
  if (res.status === 204 || res.status === 404) {
    return { id } as { id: string };
  }
  if (!res.ok) {
    let msg = "";
    try {
      msg = await res.text();
    } catch {
      // ignore
    }
    throw new Error(msg || "Failed to delete capsule");
  }
  try {
    const data = (await res.json()) as { id?: string };
    return { id: data.id ?? id } as { id: string };
  } catch {
    return { id } as { id: string };
  }
}

async function apiDeleteFolder(id: string) {
  const res = await fetch(`/api/folders/${id}`, { method: "DELETE", credentials: "include", cache: "no-store" });
  // Treat 204 and 404 as success to keep UI consistent for optimistic deletions
  if (res.status === 204 || res.status === 404) {
    return { id } as { id: string };
  }
  if (!res.ok) {
    let msg = "";
    try {
      msg = await res.text();
    } catch {
      // ignore
    }
    const err: Error & { status?: number } = new Error(msg || "Failed to delete folder");
    err.status = res.status;
    throw err;
  }
  try {
    const data = (await res.json()) as { id?: string };
    return { id: data.id ?? id } as { id: string };
  } catch {
    return { id } as { id: string };
  }
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
  const commitCapsuleId = useLibraryStore((s) => s.commitCapsuleId);
  const markFolderPending = useLibraryStore((s) => s.markFolderPending);
  const clearFolderPending = useLibraryStore((s) => s.clearFolderPending);
  const beginMutation = useLibraryStore((s) => s.beginMutation);
  const endMutation = useLibraryStore((s) => s.endMutation);
  const customFolderOrder = useLibraryStore((s) => s.customFolderOrder);
  const reorderFolder = useLibraryStore((s) => s.reorderFolder);
  const customCapsuleOrder = useLibraryStore((s) => s.customCapsuleOrder);
  const reorderCapsuleInFolder = useLibraryStore((s) => s.reorderCapsuleInFolder);

  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(folder.name);
  const [isDragOver, setIsDragOver] = React.useState(false);

  // Access TanStack Query client at the component level per hooks rules
  const queryClient = useQueryClient();
  const updateCapsuleFolderMutation = useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string }) => apiUpdateCapsule(id, { folderId }),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<{
        folders: Array<{ id: string; name: string; createdAt: string }>;
        capsules: Array<{ id: string; title: string; content: string; folderId: string | null; createdAt: string; updatedAt: string }>;
      }>(["library"], (prev) => {
        if (!prev) return prev;
        const now = new Date().toISOString();
        return {
          ...prev,
          capsules: prev.capsules.map((c) =>
            c.id === variables.id ? { ...c, folderId: variables.folderId, updatedAt: now } : c
          ),
        };
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });

  const deleteCapsuleMutation = useMutation({
    mutationFn: (id: string) => apiDeleteCapsule(id),
    onSuccess: (_data, id) => {
      queryClient.setQueryData<{
        folders: Array<{ id: string; name: string; createdAt: string }>;
        capsules: Array<{ id: string; title: string; content: string; folderId: string | null; createdAt: string; updatedAt: string }>;
      }>(["library"], (prev) => {
        if (!prev) return prev;
        return { ...prev, capsules: prev.capsules.filter((c) => c.id !== id) };
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["library"] })
  })
  const [open, setOpen] = React.useState(true);

  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    // Stop event bubbling immediately so the sidebar's onDrop doesn't also fire
    e.stopPropagation();
    setIsDragOver(false);
    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    if (data.startsWith("folder:")) {
      const sourceId = data.slice(7);
      if (sourceId !== folder.id) {
        const rect = e.currentTarget.getBoundingClientRect();
        const isAfter = e.clientY > rect.top + rect.height / 2;
        reorderFolder(sourceId, folder.id, isAfter ? "after" : "before");
      }
      return;
    }
    if (!data.startsWith("capsule:")) return;
    const id = data.slice(8);
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
    e.dataTransfer.dropEffect = "move";
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

  // Ordered capsules using custom order, fallback to filtered order
  const filteredCaps = capsules.filter((c) => c.folderId === folder.id);
  const key = folder.id;
  const orderIds = customCapsuleOrder[key] ?? filteredCaps.map((c) => c.id);
  const items = orderIds.map((id) => filteredCaps.find((c) => c.id === id)!).filter(Boolean);

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
      <div className="flex items-center gap-2 mb-1.5 min-w-0 cursor-grab active:cursor-grabbing" draggable onDragStart={(e) => e.dataTransfer.setData("text/plain", `folder:${folder.id}`)}>
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
            beginMutation();
            const prevFolders = useLibraryStore.getState().folders;
            const prevCaps = useLibraryStore.getState().capsules;
            const prevCache = queryClient.getQueryData<{
              folders: Array<{ id: string; name: string; createdAt: string }>;
              capsules: Array<{ id: string; title: string; content: string; folderId: string | null; createdAt: string; updatedAt: string }>;
            }>(["library"]);
            // Optimistic remove from store
            removeFolder(folder.id);
            // Optimistically update query cache to prevent flicker
            queryClient.setQueryData<{
              folders: Array<{ id: string; name: string; createdAt: string }>;
              capsules: Array<{ id: string; title: string; content: string; folderId: string | null; createdAt: string; updatedAt: string }>;
            }>(["library"], (prev) => {
              if (!prev) return prev;
              return { ...prev, folders: prev.folders.filter((f) => f.id !== folder.id) };
            });
            try {
              await apiDeleteFolder(folder.id);
              // Keep cache aligned and let background refetch reconcile
              queryClient.invalidateQueries({ queryKey: ["library"] });
            } catch (err) {
              console.error(err);
              // Roll back only when we are truly unauthorized; otherwise keep optimistic state
              const status = (err as { status?: number }).status;
              if (status === 401 || status === 403) {
                // Restore cache and store on auth errors
                if (prevCache) {
                  queryClient.setQueryData(["library"], prevCache);
                }
                useLibraryStore.setState({ folders: prevFolders, capsules: prevCaps });
              }
            } finally {
              endMutation();
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
              <div key={c.id} className={["group/cap relative"].join(" ")} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const data = e.dataTransfer.getData("text/plain"); if (!data || !data.startsWith("capsule:")) return; const sourceId = data.slice(8); if (sourceId === c.id) return; const rect = e.currentTarget.getBoundingClientRect(); const isAfter = e.clientY > rect.top + rect.height / 2; reorderCapsuleInFolder(folder.id, sourceId, c.id, isAfter ? "after" : "before"); }}>
                <button
                  className={["cap-item w-full text-left pr-20 text-xs"].join(" ")}
                  style={capStyle}
                  draggable
                  onDragStart={(e) => e.dataTransfer.setData("text/plain", `capsule:${c.id}`)}
                  onClick={() => setActiveCapsule(c.id)}
                >
                  <span className="flex items-center gap-2 min-w-0 w-full">
                    {capColor && (
                      <span className="size-2 rounded-full shrink-0" style={{ background: "var(--cap-accent)" }} />
                    )}
                     <span className="truncate min-w-0 flex-1" title={c.title || "Untitled"}>
                       {c.title || "Untitled"}
                     </span>
                     {c.id.startsWith("cap_") && (
                       <span className="text-[10px] text-amber-600">Pending sync</span>
                     )}
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
  const customCapsuleOrder = useLibraryStore((s) => s.customCapsuleOrder);
  const reorderCapsuleInFolder = useLibraryStore((s) => s.reorderCapsuleInFolder);

  const queryClient = useQueryClient();
  // Add a mutation for moving capsules to uncategorized (sidebar drop)
  const updateCapsuleFolderMutation = useMutation({
    mutationFn: ({ id, folderId }: { id: string; folderId: string | null }) =>
      apiUpdateCapsule(id, { folderId }),
    onSuccess: (_data, variables) => {
      queryClient.setQueryData<{
        folders: Array<{ id: string; name: string; createdAt: string }>;
        capsules: Array<{ id: string; title: string; content: string; folderId: string | null; createdAt: string; updatedAt: string }>;
      }>(["library"], (prev) => {
        if (!prev) return prev;
        const now = new Date().toISOString();
        return {
          ...prev,
          capsules: prev.capsules.map((c) =>
            c.id === variables.id ? { ...c, folderId: variables.folderId, updatedAt: now } : c
          ),
        };
      });
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });
  const deleteCapsuleMutation = useMutation({
    mutationFn: (id: string) => apiDeleteCapsule(id),
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });
  // Ordered unsorted capsules using custom order, fallback to filtered order
  const filteredCaps = capsules.filter((c) => c.folderId === null);
  const orderIds = customCapsuleOrder["unsorted"] ?? filteredCaps.map((c) => c.id);
  const items = orderIds.map((id) => filteredCaps.find((c) => c.id === id)!).filter(Boolean);

  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    // Prevent bubbling to the sidebar to avoid duplicate handlers
    e.stopPropagation();
    const data = e.dataTransfer.getData("text/plain");
    if (!data || !data.startsWith("capsule:")) return;
    const id = data.slice(8);
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
            <div key={c.id} className={["group/cap relative"].join(" ")} onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const data = e.dataTransfer.getData("text/plain"); if (!data || !data.startsWith("capsule:")) return; const sourceId = data.slice(8); if (sourceId === c.id) return; const rect = e.currentTarget.getBoundingClientRect(); const isAfter = e.clientY > rect.top + rect.height / 2; reorderCapsuleInFolder(null, sourceId, c.id, isAfter ? "after" : "before"); }}>
              <button
                className={["cap-item w-full text-left pr-20 text-xs"].join(" ")}
                style={capStyle}
                draggable
                onDragStart={(e) => e.dataTransfer.setData("text/plain", `capsule:${c.id}`)}
                onClick={() => setActiveCapsule(c.id)}
              >
                <span className="flex items-center gap-2 min-w-0 w-full">
                  {capColor && (
                    <span className="size-2 rounded-full shrink-0" style={{ background: "var(--cap-accent)" }} />
                  )}
                  <span className="truncate min-w-0 flex-1" title={c.title || "Untitled"}>
                    {c.title || "Untitled"}
                  </span>
                  {c.id.startsWith("cap_") && (
                    <span className="text-[10px] text-amber-600">Pending sync</span>
                  )}
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
  const pendingFolderIds = useLibraryStore((s) => s.pendingFolderIds);
  const addFolder = useLibraryStore((s) => s.addFolder);
  const addCapsule = useLibraryStore((s) => s.addCapsule);
  const moveCapsuleToFolder = useLibraryStore((s) => s.moveCapsuleToFolder);
  const setActiveCapsule = useLibraryStore((s) => s.setActiveCapsule);
  const removeCapsule = useLibraryStore((s) => s.removeCapsule);
  const removeFolder = useLibraryStore((s) => s.removeFolder);
  const commitCapsuleId = useLibraryStore((s) => s.commitCapsuleId);
  const markFolderPending = useLibraryStore((s) => s.markFolderPending);
  const clearFolderPending = useLibraryStore((s) => s.clearFolderPending);
  const beginMutation = useLibraryStore((s) => s.beginMutation);
  const endMutation = useLibraryStore((s) => s.endMutation);
  const customFolderOrder = useLibraryStore((s) => s.customFolderOrder);
  const reorderFolder = useLibraryStore((s) => s.reorderFolder);

  const { isSignedIn } = useAuth();
  const queryClient = useQueryClient();

  // Compute ordered folders based on custom order with fallback to newest-first
  const folderById = new Map(folders.map((f) => [f.id, f]));
  const defaultOrderIds = folders.slice().sort((a, b) => b.createdAt - a.createdAt).map((f) => f.id);
  const orderIds = customFolderOrder.length
    ? [...customFolderOrder.filter((id) => folderById.has(id)), ...defaultOrderIds.filter((id) => !customFolderOrder.includes(id))]
    : defaultOrderIds;
  const orderedFolders = orderIds.map((id) => folderById.get(id)!);

  // Initial server data hydration (once)
  const libraryQuery = useQuery({
    queryKey: ["library"],
    enabled: isSignedIn,
    queryFn: async () => {
      const res = await fetch("/api/library", { cache: "no-store", credentials: "include" });
      if (res.status === 401) return { folders: [], capsules: [] } as const;
      if (!res.ok) throw new Error(await res.text());
      return (await res.json()) as { folders: Array<{ id: string; name: string; createdAt: string }>; capsules: Array<{ id: string; title: string; content: string; folderId: string | null; createdAt: string; updatedAt: string }> };
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    refetchOnReconnect: true,
  });
  React.useEffect(() => {
    if (!libraryQuery.data) return;
    const s = useLibraryStore.getState();

    // Build server folders with deterministic colors
    const serverFolders: Folder[] = libraryQuery.data.folders.map((f) => ({
      id: f.id,
      name: f.name,
      createdAt: new Date(f.createdAt).getTime(),
      color: pickColorDeterministic(f.id),
    }));

    // Merge folders: update names, add missing; optionally prune if not mutating
    const curFoldersById = new Map(s.folders.map((f) => [f.id, f]));
    const nextFolders: Folder[] = [];
    for (const sf of serverFolders) {
      const cur = curFoldersById.get(sf.id);
      nextFolders.push(cur ? { ...cur, name: sf.name } : sf);
      curFoldersById.delete(sf.id);
    }
    const shouldPruneFolders = s.mutationsInFlight === 0;
    if (!shouldPruneFolders) {
      // keep any local-only folders while mutating
      nextFolders.push(...curFoldersById.values());
    }

    // Build server capsules with timestamps and derived colors
    const serverCapsules = libraryQuery.data.capsules.map((c) => ({
      id: c.id,
      title: c.title,
      folderId: c.folderId,
      content: c.content,
      createdAt: new Date(c.createdAt).getTime(),
      updatedAt: new Date(c.updatedAt).getTime(),
      color: c.folderId ? pickColorDeterministic(c.folderId) : null,
    }));

    // Merge capsules: prefer local when newer; add missing; optionally prune deletions
    const curCapsById = new Map(s.capsules.map((c) => [c.id, c]));
    const nextCapsules: typeof s.capsules = [];

    for (const sc of serverCapsules) {
      const cur = curCapsById.get(sc.id);
      if (!cur) {
        nextCapsules.push(sc);
      } else {
        const preferLocal = cur.updatedAt > sc.updatedAt || cur.id.startsWith("cap_");
        const merged = preferLocal
          ? { ...cur, color: sc.folderId ? pickColorDeterministic(sc.folderId) : null }
          : sc;
        nextCapsules.push(merged);
        curCapsById.delete(sc.id);
      }
    }

    const shouldPruneCapsules = s.mutationsInFlight === 0;
    for (const [, cur] of curCapsById) {
      // Keep local temp capsules and local-only while mutating; otherwise prune
      if (cur.id.startsWith("cap_") || !shouldPruneCapsules) {
        nextCapsules.push(cur);
      }
    }

    const preserveActive = s.activeCapsuleId;
    const nextActive = preserveActive && nextCapsules.some((c) => c.id === preserveActive)
      ? preserveActive
      : nextCapsules[0]?.id ?? null;

    useLibraryStore.setState({ folders: nextFolders, capsules: nextCapsules, activeCapsuleId: nextActive });
  }, [libraryQuery.data]);

  // Sync utilities with simple exponential backoff
  const backoffRef = React.useRef<{ delay: number; timer: ReturnType<typeof setTimeout> | null }>({ delay: 2000, timer: null });
  const syncPending = React.useCallback(async () => {
    if (!isSignedIn) return;
    const s = useLibraryStore.getState();
    const qc = queryClient;
    // Sync pending folders
    for (const fid of s.pendingFolderIds) {
      const f = s.folders.find((x) => x.id === fid);
      if (!f) {
        clearFolderPending(fid);
        continue;
      }
      try {
        const created = await apiCreateFolder({ id: f.id, name: f.name });
        clearFolderPending(fid);
        qc.setQueryData<{
          folders: Array<{ id: string; name: string; createdAt: string }>;
          capsules: Array<{ id: string; title: string; content: string; folderId: string | null; createdAt: string; updatedAt: string }>;
        }>(["library"], (prev) => {
          if (!prev) return prev;
          const exists = prev.folders.some((x) => x.id === created.id);
          const nextFolders = exists ? prev.folders : [{ id: created.id, name: created.name, createdAt: created.createdAt ?? new Date().toISOString() }, ...prev.folders];
          return { ...prev, folders: nextFolders };
        });
      } catch (err) {
        if (!isNetworkError(err)) console.error(err);
      }
    }
    // Sync temp capsules
    for (const cap of s.capsules) {
      if (!cap.id.startsWith("cap_")) continue;
      try {
        const created = await apiCreateCapsule({ title: cap.title || "Untitled", content: cap.content ?? "", folderId: cap.folderId ?? null });
        commitCapsuleId(cap.id, created.id);
        qc.setQueryData<{
          folders: Array<{ id: string; name: string; createdAt: string }>;
          capsules: Array<{ id: string; title: string; content: string; folderId: string | null; createdAt: string; updatedAt: string }>;
        }>(["library"], (prev) => {
          if (!prev) return prev;
          const now = new Date().toISOString();
          return {
            ...prev,
            capsules: [{ id: created.id, title: created.title ?? "Untitled", content: created.content ?? "", folderId: created.folderId ?? null, createdAt: now, updatedAt: now }, ...prev.capsules.filter((c) => c.id !== cap.id)],
          };
        });
      } catch (err) {
        if (!isNetworkError(err)) console.error(err);
      }
    }
  }, [commitCapsuleId, clearFolderPending, isSignedIn, queryClient]);

  const scheduleBackoff = React.useCallback(() => {
    const ref = backoffRef.current;
    if (ref.timer) return; // already scheduled
    ref.timer = setTimeout(async () => {
      ref.timer = null;
      await syncPending();
      // If still pending, increase delay; else reset
      const hasPending = useLibraryStore.getState().pendingFolderIds.length > 0 || useLibraryStore.getState().capsules.some((c) => c.id.startsWith("cap_"));
      ref.delay = hasPending ? Math.min(ref.delay * 2, 60_000) : 2000;
      if (hasPending) scheduleBackoff();
    }, ref.delay);
  }, [syncPending]);

  React.useEffect(() => {
    const onOnline = () => {
      backoffRef.current.delay = 2000;
      void syncPending();
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [syncPending]);

  const createCapsuleMutation = useMutation({
    mutationFn: apiCreateCapsule,
    onSuccess: (created) => {
      // Push new capsule into the library cache to reduce refetch cost
      queryClient.setQueryData<{
        folders: Array<{ id: string; name: string; createdAt: string }>;
        capsules: Array<{ id: string; title: string; content: string; folderId: string | null; createdAt: string; updatedAt: string }>;
      }>(
        ["library"],
        (prev) => {
          if (!prev) return prev;
          const now = new Date().toISOString();
          const nextCapsules = [
            {
              id: created.id,
              title: created.title ?? "Untitled",
              content: created.content ?? "",
              folderId: created.folderId ?? null,
              createdAt: now,
              updatedAt: now,
            },
            ...prev.capsules,
          ];
          return { ...prev, capsules: nextCapsules };
        }
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });
  const createFolderMutation = useMutation({
    mutationFn: apiCreateFolder,
    onSuccess: (created) => {
      queryClient.setQueryData<{
        folders: Array<{ id: string; name: string; createdAt: string }>;
        capsules: Array<{ id: string; title: string; content: string; folderId: string | null; createdAt: string; updatedAt: string }>;
      }>(
        ["library"],
        (prev) => {
          if (!prev) return prev;
          const nextFolders = [
            { id: created.id, name: created.name, createdAt: created.createdAt ?? new Date().toISOString() },
            ...prev.folders,
          ];
          return { ...prev, folders: nextFolders };
        }
      );
    },
    onSettled: () => queryClient.invalidateQueries({ queryKey: ["library"] }),
  });

  const onSidebarDrop: React.DragEventHandler<HTMLElement> = async (e) => {
    e.preventDefault();
    // Ensure the drop does not bubble further
    e.stopPropagation();
    const data = e.dataTransfer.getData("text/plain");
    if (!data || !data.startsWith("capsule:")) return;
    const id = data.slice(8);
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
                // Keep local capsule on network error so user can continue and Save later
                if (!isNetworkError(err)) {
                  console.error(err);
                  removeCapsule(tempId);
                } else {
                  setActiveCapsule(tempId);
                  scheduleBackoff();
                }
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
                // Keep local folder on network error; it will sync when connection resumes
                if (!isNetworkError(err)) {
                  console.error(err);
                  removeFolder(tempId);
                } else {
                  markFolderPending(tempId);
                  scheduleBackoff();
                }
              }
            }}
          >
            <FolderIcon size={16} weight="fill" />
          </button>
          <button
            className="size-8 grid place-items-center rounded-md hover:bg-muted"
            aria-label="Sync now"
            title="Sync now"
            onClick={() => {
              backoffRef.current.delay = 2000;
              void syncPending();
            }}
          >
            <ArrowClockwiseIcon size={16} />
          </button>
        </div>
      </div>
      <div className="grid gap-3">
        {orderedFolders.map((f) => (
          <div key={f.id} className="relative">
            {pendingFolderIds.includes(f.id) && (
              <span className="absolute right-2 top-1 text-[10px] text-amber-600">Pending sync</span>
            )}
            <FolderItem folder={f} />
          </div>
        ))}
        {orderedFolders.length === 0 && (
          <div className="text-xs text-muted-foreground">Create a folder to organize your docs.</div>
        )}
        {/* End-of-list drop zone to place folder at bottom */}
        {orderedFolders.length > 0 && (
          <div
            className="h-6 mt-1 rounded-md border border-dashed border-muted-foreground/30"
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
            onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const data = e.dataTransfer.getData("text/plain"); if (!data || !data.startsWith("folder:")) return; const sourceId = data.slice(7); const lastId = orderedFolders[orderedFolders.length - 1]?.id; if (!lastId || sourceId === lastId) return; reorderFolder(sourceId, lastId, "after"); }}
            aria-label="Drop here to place folder at end"
          />
        )}
      </div>
      <OrphanList />
    </aside>
  );
}
