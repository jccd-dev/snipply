"use client";

import * as React from "react";
import { useLibraryStore, type Folder } from "@/store/library";
import { FolderIcon, CaretRightIcon, PlusIcon, TrashIcon } from "@phosphor-icons/react";
import { pickColorDeterministic } from "@/theme/palette";

// API helpers
async function apiCreateCapsule(payload: { title?: string; content?: string; folderId?: string | null }) {
  const res = await fetch("/api/capsules", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { id: string; title: string; folderId: string | null; content: string };
}

async function apiUpdateCapsule(id: string, payload: Partial<{ title: string; content: string; folderId: string | null }>) {
  const res = await fetch(`/api/capsules/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
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
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { id: string; name: string; createdAt: string };
}

async function apiUpdateFolder(id: string, payload: { name?: string }) {
  const res = await fetch(`/api/folders/${id}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { id: string; name: string };
}

// New: DELETE API helpers
async function apiDeleteCapsule(id: string) {
  const res = await fetch(`/api/capsules/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { id: string };
}

async function apiDeleteFolder(id: string) {
  const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
  if (!res.ok) throw new Error(await res.text());
  return (await res.json()) as { id: string };
}

function FolderItem({ folder }: { folder: Folder }): React.ReactElement {
  const { renameFolder, capsules, moveCapsuleToFolder, setActiveCapsule, removeCapsule, removeFolder } = useLibraryStore();
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(folder.name);
  const [open, setOpen] = React.useState(true);

  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const prevFolder = capsules.find((c) => c.id === id)?.folderId ?? null;
    moveCapsuleToFolder(id, folder.id);
    try {
      await apiUpdateCapsule(id, { folderId: folder.id });
    } catch (err) {
      console.error(err);
      // rollback
      moveCapsuleToFolder(id, prevFolder);
    }
    e.stopPropagation();
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const items = capsules.filter((c) => c.folderId === folder.id);

  // Use folder hex color directly via CSS custom property
  const folderStyle = { ["--folder-accent" as any]: folder.color } as React.CSSProperties;

  return (
    <div
      className={["card w-full px-2 pt-2 pb-1 overflow-hidden"].join(" ")}
      style={{ ...folderStyle, borderColor: "var(--folder-accent)" }}
      onDragOver={onDragOver}
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
                await apiUpdateFolder(folder.id, { name: newName });
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
              await apiDeleteFolder(folder.id);
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
                    removeCapsule(c.id);
                    try {
                      await apiDeleteCapsule(c.id);
                    } catch (err) {
                      console.error(err);
                      useLibraryStore.setState({ capsules: prevCaps });
                    }
                  }}
                >
                  <Trash size={12} />
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
  const { capsules, moveCapsuleToFolder, setActiveCapsule } = useLibraryStore();
  const items = capsules.filter((c) => c.folderId === null);

  const onDrop: React.DragEventHandler<HTMLDivElement> = async (e) => {
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const prevFolder = capsules.find((c) => c.id === id)?.folderId ?? null;
    moveCapsuleToFolder(id, null);
    try {
      await apiUpdateCapsule(id, { folderId: null });
    } catch (err) {
      console.error(err);
      moveCapsuleToFolder(id, prevFolder);
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
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function RightSidebar(): React.ReactElement {
  const { folders, capsules, addFolder, addCapsule, moveCapsuleToFolder, setActiveCapsule, removeCapsule, removeFolder, commitCapsuleId } = useLibraryStore();

  // Initial server data hydration (once)
  const hydratedRef = React.useRef(false);
  React.useEffect(() => {
    if (hydratedRef.current) return;
    const looksEmpty = folders.length === 0 || (capsules.length === 1 && (capsules[0]?.title ?? "") === "Getting Started");
    if (!looksEmpty) return;
    (async () => {
      try {
        const res = await fetch("/api/library", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { folders: Array<{ id: string; name: string; createdAt: string }>; capsules: Array<{ id: string; title: string; content: string; folderId: string | null; createdAt: string; updatedAt: string }>; };
        const serverFolders: Folder[] = data.folders.map((f) => ({ id: f.id, name: f.name, createdAt: new Date(f.createdAt).getTime(), color: pickColorDeterministic(f.id) }));
        const serverCapsules = data.capsules.map((c) => ({ id: c.id, title: c.title, folderId: c.folderId, content: c.content, createdAt: new Date(c.createdAt).getTime(), updatedAt: new Date(c.updatedAt).getTime(), color: c.folderId ? pickColorDeterministic(c.folderId) : null }));
        useLibraryStore.setState({ folders: serverFolders, capsules: serverCapsules, activeCapsuleId: serverCapsules[0]?.id ?? null });
        hydratedRef.current = true;
      } catch (e) {
        console.error("Failed to hydrate library", e);
      }
    })();
  }, [folders.length, capsules.length]);

  const onSidebarDrop: React.DragEventHandler<HTMLElement> = async (e) => {
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    const prevFolder = capsules.find((c) => c.id === id)?.folderId ?? null;
    // Dropping on the sidebar background removes the folder association (uncategorized)
    moveCapsuleToFolder(id, null);
    try {
      await apiUpdateCapsule(id, { folderId: null });
    } catch (err) {
      console.error(err);
      moveCapsuleToFolder(id, prevFolder);
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
              try {
                const created = await apiCreateCapsule({ title: "Untitled", folderId: null });
                commitCapsuleId(tempId, created.id);
                setActiveCapsule(created.id);
              } catch (err) {
                console.error(err);
                removeCapsule(tempId);
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
                await apiCreateFolder({ id: tempId, name: "New Folder" });
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
