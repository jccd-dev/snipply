"use client";

import * as React from "react";
import { useLibraryStore, type Folder } from "@/store/library";
import { FolderIcon, CaretRightIcon, PlusIcon } from "@phosphor-icons/react";

function FolderItem({ folder }: { folder: Folder }): React.ReactElement {
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
            onBlur={() => {
              renameFolder(folder.id, name.trim() || "New Folder");
              setEditing(false);
            }}
            className="bg-transparent focus:outline-none text-sm font-medium truncate min-w-0 flex-1"
            autoFocus
          />
        ) : (
          <button className="text-left text-sm font-medium truncate min-w-0 flex-1" onClick={() => setEditing(true)}>
            {folder.name}
          </button>
        )}
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

  const onDrop: React.DragEventHandler<HTMLDivElement> = (e) => {
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    moveCapsuleToFolder(id, null);
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
  const { folders, addFolder, addCapsule, moveCapsuleToFolder } = useLibraryStore();

  const onSidebarDrop: React.DragEventHandler<HTMLElement> = (e) => {
    const id = e.dataTransfer.getData("text/plain");
    if (!id) return;
    // Dropping on the sidebar background removes the folder association (uncategorized)
    moveCapsuleToFolder(id, null);
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
            onClick={() => addCapsule("Untitled", null)}
          >
            <PlusIcon size={16} />
          </button>
          <button
            className="size-8 grid place-items-center rounded-md hover:bg-muted"
            aria-label="New Folder"
            title="New Folder"
            onClick={() => addFolder("New Folder")}
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
