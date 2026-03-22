"use client";

import * as React from "react";
import { useLibraryStore, type Folder } from "@/store/library";
import { FolderIcon, CaretRightIcon, PlusIcon, TrashIcon, ArrowClockwiseIcon, FileTextIcon } from "@phosphor-icons/react";
import { MoreHorizontal, Search } from "lucide-react";
import { pickColorDeterministic } from "@/theme/palette";
import { useAuth } from "@clerk/nextjs";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from "@/components/ui/alert-dialog";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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
function FolderItem({ folder, searchQuery }: { folder: Folder; searchQuery: string }): React.ReactElement | null {
  // Optimize store subscriptions - use selective subscriptions for better re-render performance
  const renameFolder = useLibraryStore((s) => s.renameFolder);
  const capsules = useLibraryStore((s) => s.capsules);
  const activeCapsuleId = useLibraryStore((s) => s.activeCapsuleId);
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
  const [dropPosition, setDropPosition] = React.useState<"before" | "after" | null>(null);

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
  const [capsuleToDelete, setCapsuleToDelete] = React.useState<{ id: string; title: string } | null>(null);
  const [folderToDelete, setFolderToDelete] = React.useState<{ id: string; name: string } | null>(null);

  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    e.preventDefault();
    // Stop event bubbling immediately so the sidebar's onDrop doesn't also fire
    e.stopPropagation();
    setIsDragOver(false);
    const finalDropPosition = dropPosition;
    setDropPosition(null);

    const data = e.dataTransfer.getData("text/plain");
    if (!data) return;
    if (data.startsWith("folder:")) {
      const sourceId = data.slice(7);
      if (sourceId !== folder.id) {
        const isAfter = finalDropPosition === "after";
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

    // Determine if dropping before or after for folder reordering
    if (e.dataTransfer.types.includes("text/plain")) {
      // Check if we are dragging a folder (unfortunately we can't read getData in dragover,
      // but we can assume if they want lines they are dragging folders, if they want rings they drag capsules.
      // A better way is to track the dragType via global state, but for now we can infer from our custom layout)
      const rect = e.currentTarget.getBoundingClientRect();
      const isAfter = e.clientY > rect.top + rect.height / 2;
      setDropPosition(isAfter ? "after" : "before");
    }

    setIsDragOver(true);
  };

  const onDragLeave: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
    // Only clear drag over if we're actually leaving the folder container
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragOver(false);
      setDropPosition(null);
    }
  };

  // Ordered capsules using custom order, fallback to filtered order
  const filteredCaps = capsules.filter((c) => c.folderId === folder.id);
  const searchedCaps = searchQuery
    ? filteredCaps.filter(c => c.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : filteredCaps;

  const folderMatches = folder.name.toLowerCase().includes(searchQuery.toLowerCase());

  const key = folder.id;
  const baseOrderIds = customCapsuleOrder[key] ?? filteredCaps.map((c) => c.id);
  const orderIds = Array.from(new Set([
    ...baseOrderIds.filter((id) => searchedCaps.some((c) => c.id === id)),
    ...searchedCaps.map((c) => c.id).filter((id) => !baseOrderIds.includes(id)),
  ]));
  const items = orderIds.map((id) => searchedCaps.find((c) => c.id === id)!).filter(Boolean);

  // Auto-expand if searching and there are matching items inside
  React.useEffect(() => {
    if (searchQuery && searchedCaps.length > 0) {
      setOpen(true);
    }
  }, [searchQuery, searchedCaps.length]);

  if (searchQuery && !folderMatches && searchedCaps.length === 0) {
    return null;
  }

  return (
    <div className="relative">
      {/* Visual drop indicator for "before" (only for folders) */}
      {isDragOver && dropPosition === "before" && useLibraryStore.getState().dragType === "folder" && (
        <div className="absolute -top-1.5 left-0 right-0 h-1 bg-blue-500 rounded-full z-10" />
      )}

      <div
        className={[
          "w-full pt-1 pb-1 overflow-hidden transition-all duration-200 group/folder",
          isDragOver && useLibraryStore.getState().dragType === "capsule" ? "ring-2 ring-blue-400 bg-blue-50/50 dark:bg-blue-950/20 rounded-md" : ""
        ].join(" ")}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        aria-label={`Folder ${folder.name}`}
        aria-expanded={open}
      >
      <div className="flex items-center gap-2 mb-1.5 min-w-0 cursor-grab active:cursor-grabbing hover:bg-muted/50 rounded-md px-2 py-1" draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", `folder:${folder.id}`); useLibraryStore.getState().setDragType("folder"); }} onDragEnd={() => useLibraryStore.getState().setDragType(null)}>
        <button
          type="button"
          aria-label={open ? "Collapse folder" : "Expand folder"}
          onClick={() => setOpen((v) => !v)}
          className="size-5 grid place-items-center rounded-md hover:bg-muted shrink-0 text-muted-foreground"
        >
          <CaretRightIcon size={12} className={["smooth", open ? "rotate-90" : "rotate-0"].join(" ")} />
        </button>
        <span className="inline-flex items-center gap-1.5 shrink-0 text-muted-foreground">
          <FolderIcon size={16} />
        </span>
        {editing ? (
          <div className="min-w-0 flex-1 flex">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.currentTarget.blur();
                }
              }}
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
              className="w-full bg-transparent focus:outline-none text-sm font-medium h-5"
              autoFocus
            />
          </div>
        ) : (
          <button
            className="text-left text-sm font-medium truncate min-w-0 flex-1"
            onClick={() => setOpen((v) => !v)}
            title={folder.name}
          >
            {folder.name.length > 25 ? folder.name.slice(0, 25) + "..." : folder.name}
          </button>
        )}

        {/* Dropdown for Folder Actions */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="icon-xs"
              className="opacity-0 group-hover/folder:opacity-100 transition text-muted-foreground hover:text-foreground shrink-0"
              onClick={(e) => {
                e.stopPropagation();
                e.preventDefault();
              }}
            >
              <MoreHorizontal />
              <span className="sr-only">Folder Actions</span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem
              onSelect={(e) => {
                e.preventDefault();
                setEditing(true);
              }}
            >
              Rename
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              className="text-destructive focus:text-destructive"
              onSelect={(e) => {
                e.preventDefault();
                setFolderToDelete({ id: folder.id, name: folder.name });
              }}
            >
              Delete Folder
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      {open && (
        <div className="flex flex-col gap-[2px] relative">
          <div className="absolute left-4 top-0 bottom-0 w-px bg-border/50" />
          {items.map((c) => {
            const isActive = activeCapsuleId === c.id;
            return (
              <div key={c.id} className="group/cap relative pl-6" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const data = e.dataTransfer.getData("text/plain"); if (!data || !data.startsWith("capsule:")) return; const sourceId = data.slice(8); if (sourceId === c.id) return; const rect = e.currentTarget.getBoundingClientRect(); const isAfter = e.clientY > rect.top + rect.height / 2; reorderCapsuleInFolder(folder.id, sourceId, c.id, isAfter ? "after" : "before"); }}>
                <button
                  className={["w-full text-left pr-8 pl-3 py-1.5 text-sm rounded-md transition-colors border", isActive ? "bg-primary text-primary-foreground border-primary" : "bg-transparent border-transparent hover:bg-muted text-muted-foreground hover:text-foreground"].join(" ")}
                  draggable
                  onDragStart={(e) => { e.dataTransfer.setData("text/plain", `capsule:${c.id}`); useLibraryStore.getState().setDragType("capsule"); }}
                  onDragEnd={() => useLibraryStore.getState().setDragType(null)}
                  onClick={() => setActiveCapsule(c.id)}
                >
                  <span className="flex items-center gap-2 min-w-0 w-full">
                    <FileTextIcon size={14} className="shrink-0" />
                    <span className="truncate min-w-0 flex-1" title={c.title || "Untitled"}>
                      {c.title || "Untitled"}
                    </span>
                    {c.id.startsWith("cap_") && (
                      <span className="text-[10px] text-amber-400">Syncing...</span>
                    )}
                  </span>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon-xs"
                      className={["absolute right-1 top-1.5 opacity-0 group-hover/cap:opacity-100 transition", isActive ? "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/20" : "text-muted-foreground hover:text-foreground"].join(" ")}
                      onClick={(e) => {
                        e.stopPropagation();
                        e.preventDefault();
                      }}
                    >
                      <MoreHorizontal />
                      <span className="sr-only">Actions</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-40">
                    <DropdownMenuItem disabled>Archive (soon)</DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem
                      className="text-destructive focus:text-destructive"
                      onSelect={(e) => {
                        e.preventDefault();
                        setCapsuleToDelete({ id: c.id, title: c.title || "Untitled" });
                      }}
                    >
                      Delete
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            );
          })}
          {items.length === 0 && !searchQuery && (
            <div className="text-xs text-muted-foreground pl-9 py-2">Empty folder</div>
          )}
        </div>
      )}
      {/* Visual drop indicator for "after" (only for folders) */}
      {isDragOver && dropPosition === "after" && useLibraryStore.getState().dragType === "folder" && (
        <div className="absolute -bottom-1.5 left-0 right-0 h-1 bg-blue-500 rounded-full z-10" />
      )}
      </div>
      <AlertDialog open={!!capsuleToDelete} onOpenChange={(openState) => { if (!openState) setCapsuleToDelete(null); }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete capsule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {capsuleToDelete?.title ?? "this capsule"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!capsuleToDelete) return;
                const deleting = capsuleToDelete;
                setCapsuleToDelete(null);
                const prevCaps = useLibraryStore.getState().capsules;
                beginMutation();
                removeCapsule(deleting.id);
                try {
                  await deleteCapsuleMutation.mutateAsync(deleting.id);
                  toast.success("Capsule deleted");
                } catch (err) {
                  console.error(err);
                  useLibraryStore.setState({ capsules: prevCaps });
                  toast.error("Failed to delete capsule");
                } finally {
                  endMutation();
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      <AlertDialog open={!!folderToDelete} onOpenChange={(openState) => { if (!openState) setFolderToDelete(null); }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete folder?</AlertDialogTitle>
            <AlertDialogDescription>
              This will delete {folderToDelete?.name ?? "this folder"}. Capsules inside will become uncategorized.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              onClick={async () => {
                if (!folderToDelete) return;
                const deleting = folderToDelete;
                setFolderToDelete(null);
                beginMutation();
                const prevFolders = useLibraryStore.getState().folders;
                const prevCaps = useLibraryStore.getState().capsules;
                const prevCache = queryClient.getQueryData<{
                  folders: Array<{ id: string; name: string; createdAt: string }>;
                  capsules: Array<{ id: string; title: string; content: string; folderId: string | null; createdAt: string; updatedAt: string }>;
                }>(["library"]);
                removeFolder(deleting.id);
                queryClient.setQueryData<{
                  folders: Array<{ id: string; name: string; createdAt: string }>;
                  capsules: Array<{ id: string; title: string; content: string; folderId: string | null; createdAt: string; updatedAt: string }>;
                }>(["library"], (prev) => {
                  if (!prev) return prev;
                  return { ...prev, folders: prev.folders.filter((f) => f.id !== deleting.id) };
                });
                try {
                  await apiDeleteFolder(deleting.id);
                  queryClient.invalidateQueries({ queryKey: ["library"] });
                  toast.success("Folder deleted");
                } catch (err) {
                  console.error(err);
                  const status = (err as { status?: number }).status;
                  if (status === 401 || status === 403) {
                    if (prevCache) queryClient.setQueryData(["library"], prevCache);
                    useLibraryStore.setState({ folders: prevFolders, capsules: prevCaps });
                  }
                  toast.error("Failed to delete folder");
                } finally {
                  endMutation();
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function OrphanList({ searchQuery }: { searchQuery: string }): React.ReactElement | null {
  // Optimize store subscriptions - use selective subscriptions for better re-render performance
  const capsules = useLibraryStore((s) => s.capsules);
  const activeCapsuleId = useLibraryStore((s) => s.activeCapsuleId);
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
  const [capsuleToDelete, setCapsuleToDelete] = React.useState<{ id: string; title: string } | null>(null);
  // Ordered unsorted capsules using custom order, fallback to filtered order
  const filteredCaps = capsules.filter((c) => c.folderId === null);
  const searchedCaps = searchQuery
    ? filteredCaps.filter(c => c.title?.toLowerCase().includes(searchQuery.toLowerCase()))
    : filteredCaps;

  const baseOrderIds = customCapsuleOrder["unsorted"] ?? filteredCaps.map((c) => c.id);
  const orderIds = Array.from(new Set([
    ...baseOrderIds.filter((id) => searchedCaps.some((c) => c.id === id)),
    ...searchedCaps.map((c) => c.id).filter((id) => !baseOrderIds.includes(id)),
  ]));
  const items = orderIds.map((id) => searchedCaps.find((c) => c.id === id)!).filter(Boolean);

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
    <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} aria-label="Documents" className="mt-8">
      <div className="text-xs font-semibold text-muted-foreground mb-3 px-2 tracking-wider">RECENT CAPSULES</div>
      <div className="flex flex-col gap-[2px]">
        {items.map((c) => {
          const isActive = activeCapsuleId === c.id;
          return (
            <div key={c.id} className="group/cap relative" onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }} onDrop={(e) => { e.preventDefault(); e.stopPropagation(); const data = e.dataTransfer.getData("text/plain"); if (!data || !data.startsWith("capsule:")) return; const sourceId = data.slice(8); if (sourceId === c.id) return; const rect = e.currentTarget.getBoundingClientRect(); const isAfter = e.clientY > rect.top + rect.height / 2; reorderCapsuleInFolder(null, sourceId, c.id, isAfter ? "after" : "before"); }}>
              <button
                className={["w-full text-left pr-8 pl-3 py-2 text-sm rounded-md transition-colors border", isActive ? "bg-primary text-primary-foreground border-primary" : "bg-transparent border-transparent hover:bg-muted text-muted-foreground hover:text-foreground"].join(" ")}
                draggable onDragStart={(e) => { e.dataTransfer.setData("text/plain", `capsule:${c.id}`); useLibraryStore.getState().setDragType("capsule"); }} onDragEnd={() => useLibraryStore.getState().setDragType(null)} onClick={() => setActiveCapsule(c.id)}>
                <span className="flex items-center gap-2 min-w-0 w-full">
                  <FileTextIcon size={16} className="shrink-0" />
                  <span className="truncate min-w-0 flex-1" title={c.title || "Untitled"}>{c.title || "Untitled"}</span>
                  {c.id.startsWith("cap_") && <span className="text-[10px] text-amber-400">Syncing...</span>}
                </span>
              </button>
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button
                    variant="ghost"
                    size="icon-xs"
                    className={["absolute right-1 top-2 opacity-0 group-hover/cap:opacity-100 transition", isActive ? "text-primary-foreground/80 hover:text-primary-foreground hover:bg-primary-foreground/20" : "text-muted-foreground hover:text-foreground"].join(" ")}
                    onClick={(e) => {
                      e.stopPropagation();
                      e.preventDefault();
                    }}
                  >
                    <MoreHorizontal />
                    <span className="sr-only">Actions</span>
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="w-40">
                  <DropdownMenuItem disabled>Archive (soon)</DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => setCapsuleToDelete({ id: c.id, title: c.title || "Untitled" })}>
                    Delete
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>
          );
        })}
      </div>
      <AlertDialog open={!!capsuleToDelete} onOpenChange={(openState) => { if (!openState) setCapsuleToDelete(null); }}>
        <AlertDialogContent size="sm">
          <AlertDialogHeader>
            <AlertDialogTitle>Delete capsule?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete {capsuleToDelete?.title ?? "this capsule"}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction variant="destructive" onClick={async () => {
              if (!capsuleToDelete) return;
              const deleting = capsuleToDelete;
              setCapsuleToDelete(null);
              const prevCaps = useLibraryStore.getState().capsules;
              beginMutation();
              useLibraryStore.getState().removeCapsule(deleting.id);
              try {
                await deleteCapsuleMutation.mutateAsync(deleting.id);
                toast.success("Capsule deleted");
              } catch (err) {
                console.error(err);
                useLibraryStore.setState({ capsules: prevCaps });
                toast.error("Failed to delete capsule");
              } finally {
                endMutation();
              }
            }}>
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
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

  const [searchQuery, setSearchQuery] = React.useState("");

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
      className="w-full border-l border-border bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-[calc(100vh-56px)] sticky top-14 p-3 space-y-4 overflow-y-auto overflow-x-hidden"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onSidebarDrop}
    >
      <div className="flex items-center gap-2 px-2">
        <div className="text-xs font-semibold tracking-widest text-muted-foreground uppercase">Library</div>
        <div className="ms-auto flex gap-1.5">
          <button
            className="size-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
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
            className="size-7 grid place-items-center rounded-md hover:bg-muted text-muted-foreground hover:text-foreground transition-colors"
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
            <FolderIcon size={16} />
          </button>
        </div>
      </div>

      <div className="px-2">
        <div className="relative">
          <Search className="absolute left-2.5 top-2 h-4 w-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Search in library..."
            className="pl-8 bg-muted/50 border-none text-sm h-8"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
      </div>

      <div className="grid gap-0">
        {orderedFolders.map((f) => (
          <div key={f.id} className="relative">
            {pendingFolderIds.includes(f.id) && (
              <span className="absolute right-2 top-1 text-[10px] text-amber-600">Pending sync</span>
            )}
            <FolderItem folder={f} searchQuery={searchQuery} />
          </div>
        ))}
        {orderedFolders.length === 0 && !searchQuery && (
          <div className="text-xs text-muted-foreground px-2">Create a folder to organize your docs.</div>
        )}
        {/* End-of-list drop zone to place folder at bottom */}
        {orderedFolders.length > 0 && !searchQuery && (
          <div
            className="h-6 mt-1 rounded-md border border-dashed border-transparent hover:border-muted-foreground/30 transition-colors"
            onDragOver={(e) => { e.preventDefault(); e.dataTransfer.dropEffect = "move"; }}
            onDrop={(e) => {
              e.preventDefault();
              e.stopPropagation();
              const data = e.dataTransfer.getData("text/plain");
              if (!data || !data.startsWith("folder:")) return;
              const sourceId = data.slice(7);
              const lastId = orderedFolders[orderedFolders.length - 1].id;
              if (sourceId !== lastId) {
                reorderFolder(sourceId, lastId, "after");
              }
            }}
          />
        )}
      </div>
      <OrphanList searchQuery={searchQuery} />
    </aside>
  );
}
