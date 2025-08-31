"use client";

import * as React from "react";
import { useLibraryStore, type Folder } from "@/store/library";
import { Folder as FolderIcon, CaretRight, Plus } from "@phosphor-icons/react";

function FolderItem({ folder }: { folder: Folder }): JSX.Element {
  const { renameFolder, capsules, moveCapsuleToFolder, setActiveCapsule } = useLibraryStore();
  const [editing, setEditing] = React.useState(false);
  const [name, setName] = React.useState(folder.name);
  const [open, setOpen] = React.useState(true);

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    moveCapsuleToFolder(id, folder.id);
    e.stopPropagation();
  };

  const onDragOver: React.DragEventHandler<HTMLDivElement> = (e) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const items = capsules.filter((c) => c.folderId === folder.id);

  return (
    <div
      className="card px-2 pt-2 pb-1"
      onDragOver={onDragOver}
      onDrop={onDrop}
      aria-label={`Folder ${folder.name}`}
      aria-expanded={open}
    >
      <div className="flex items-center gap-2 mb-1.5">
        <button
          type="button"
          aria-label={open ? "Collapse folder" : "Expand folder"}
          onClick={() => setOpen((v) => !v)}
          className="size-6 grid place-items-center rounded-md hover:bg-black/[.05] dark:hover:bg-white/[.06]"
        >
          <CaretRight size={14} className={["smooth", open ? "rotate-90" : "rotate-0"].join(" ")} />
        </button>
        <FolderIcon size={16} className="opacity-80" />
        {editing ? (
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => {
              renameFolder(folder.id, name.trim() || "New Folder");
              setEditing(false);
            }}
            className="bg-transparent focus:outline-none text-sm font-medium"
            autoFocus
          />
        ) : (
          <button className="text-left text-sm font-medium" onClick={() => setEditing(true)}>
            {folder.name}
          </button>
        )}
      </div>
      {open && (
        <div className="flex flex-col gap-1">
          {items.map((c) => (
            <button
              key={c.id}
              className="w-full text-left px-3 py-2 text-sm rounded-md bg-black/[.03] dark:bg-white/[.04] hover:bg-black/[.06] dark:hover:bg-white/[.08]"
              draggable
              onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
              onClick={() => setActiveCapsule(c.id)}
            >
              {c.title || "Untitled"}
            </button>
          ))}
          {items.length === 0 && (
            <div className="text-xs text-muted-foreground px-3 py-2">Drop docs here</div>
          )}
        </div>
      )}
    </div>
  );
}

function OrphanList(): JSX.Element | null {
  const { capsules, moveCapsuleToFolder, setActiveCapsule } = useLibraryStore();
  const items = capsules.filter((c) => c.folderId === null);

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    moveCapsuleToFolder(id, null);
  };

  if (items.length === 0) return null;

  return (
    <div onDragOver={(e) => e.preventDefault()} onDrop={onDrop} aria-label="Documents">
      <div className="flex flex-col gap-1">
        {items.map((c) => (
          <button
            key={c.id}
            className="w-full text-left px-3 py-2 text-sm rounded-md bg-black/[.03] dark:bg-white/[.04] hover:bg-black/[.06] dark:hover:bg-white/[.08]"
            draggable
            onDragStart={(e) => e.dataTransfer.setData("text/plain", c.id)}
            onClick={() => setActiveCapsule(c.id)}
          >
            {c.title || "Untitled"}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function RightSidebar(): JSX.Element {
  const { folders, addFolder, addCapsule, moveCapsuleToFolder } = useLibraryStore();

  const onSidebarDrop: React.DragEventHandler<HTMLElement> = (e) => {
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    // Dropping on the sidebar background removes the folder association (uncategorized)
    moveCapsuleToFolder(id, null);
  };

  return (
    <aside
      className="w-full border-l border-[var(--border)] bg-background/50 backdrop-blur supports-[backdrop-filter]:bg-background/60 h-[calc(100vh-56px)] sticky top-14 p-3 space-y-3 overflow-y-auto"
      onDragOver={(e) => e.preventDefault()}
      onDrop={onSidebarDrop}
    >
      <div className="flex items-center gap-2">
        <div className="text-sm font-semibold">Library</div>
        <div className="ms-auto flex gap-1.5">
          <button
            className="size-8 grid place-items-center rounded-md hover:bg-black/[.05] dark:hover:bg-white/[.06]"
            aria-label="New Doc"
            title="New Doc"
            onClick={() => addCapsule("Untitled", null)}
          >
            <Plus size={16} />
          </button>
          <button
            className="size-8 grid place-items-center rounded-md hover:bg-black/[.05] dark:hover:bg-white/[.06]"
            aria-label="New Folder"
            title="New Folder"
            onClick={() => addFolder("New Folder")}
          >
            <FolderIcon size={16} />
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