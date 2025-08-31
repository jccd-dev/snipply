"use client";
import React from "react";

type Capsule = { id: string; title: string };
interface Folder {
  id: string;
  name: string;
  capsuleIds: string[];
}

function useDemoData() {
  const [capsules, setCapsules] = React.useState<Record<string, Capsule>>({
    c1: { id: "c1", title: "Getting Started" },
    c2: { id: "c2", title: "Installation" },
    c3: { id: "c3", title: "CLI Reference" },
    c4: { id: "c4", title: "API Overview" },
    c5: { id: "c5", title: "Styling" },
    c6: { id: "c6", title: "Layouts" },
  });
  const [folders, setFolders] = React.useState<Record<string, Folder>>({
    f1: { id: "f1", name: "Basics", capsuleIds: ["c1", "c2"] },
    f2: { id: "f2", name: "Guides", capsuleIds: [] },
    f3: { id: "f3", name: "Advanced", capsuleIds: ["c4"] },
  });
  const [unsorted, setUnsorted] = React.useState<string[]>(["c3", "c5", "c6"]);

  function moveCapsule(capsuleId: string, target: { type: "folder" | "unsorted"; id?: string }) {
    // Remove from all locations
    setFolders((prev) => {
      const draft: Record<string, Folder> = {};
      for (const [key, f] of Object.entries(prev)) {
        draft[key] = { ...f, capsuleIds: f.capsuleIds.filter((id) => id !== capsuleId) };
      }
      return draft;
    });
    setUnsorted((prev) => prev.filter((id) => id !== capsuleId));

    // Add to target
    if (target.type === "unsorted") {
      setUnsorted((prev) => (prev.includes(capsuleId) ? prev : [...prev, capsuleId]));
    } else if (target.type === "folder" && target.id) {
      setFolders((prev) => ({
        ...prev,
        [target.id!]: { ...prev[target.id!], capsuleIds: [...prev[target.id!].capsuleIds, capsuleId] },
      }));
    }
  }

  return { capsules, folders, setFolders, unsorted, setUnsorted, moveCapsule };
}

export default function CapsulesBoard() {
  const { capsules, folders, unsorted, moveCapsule } = useDemoData();
  const [dragId, setDragId] = React.useState<string | null>(null);

  function onDragStart(e: React.DragEvent, id: string) {
    setDragId(id);
    e.dataTransfer.setData("text/plain", id);
    e.dataTransfer.effectAllowed = "move";
  }
  function onDropToUnsorted(e: React.DragEvent) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) moveCapsule(id, { type: "unsorted" });
  }
  function onDropToFolder(e: React.DragEvent, folderId: string) {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/plain");
    if (id) moveCapsule(id, { type: "folder", id: folderId });
  }

  return (
    <div className="flex flex-col gap-4 p-4 pt-0">
      <section className="grid gap-4 md:grid-cols-3 auto-rows-min">
        {Object.values(folders).map((f) => (
          <div
            key={f.id}
            className="card smooth p-4 min-h-[160px] group"
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => onDropToFolder(e, f.id)}
            onDragEnter={(e) => e.preventDefault()}
            role="region"
            aria-label={`Folder ${f.name}`}
          >
            <div className="flex items-center justify-between mb-3">
              <div className="font-medium opacity-90">{f.name}</div>
              <div className="text-xs rounded-md px-2 py-1 border border-[var(--border)] opacity-70">{f.capsuleIds.length} items</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {f.capsuleIds.map((id) => (
                <button
                  key={id}
                  draggable
                  onDragStart={(e) => onDragStart(e, id)}
                  className={`tab-chip smooth px-3 py-1.5 text-xs ${dragId === id ? "opacity-60 scale-[.98]" : ""}`}
                  title={capsules[id]?.title}
                >
                  {capsules[id]?.title}
                </button>
              ))}
              {f.capsuleIds.length === 0 && (
                <div className="text-xs opacity-50">Drop capsules here</div>
              )}
            </div>
          </div>
        ))}
      </section>

      <section
        className="card smooth p-4"
        onDragOver={(e) => e.preventDefault()}
        onDrop={onDropToUnsorted}
        onDragEnter={(e) => e.preventDefault()}
        role="region"
        aria-label="Unsorted"
      >
        <div className="flex items-center justify-between mb-3">
          <div className="font-medium opacity-90">Unsorted</div>
          <div className="text-xs rounded-md px-2 py-1 border border-[var(--border)] opacity-70">{unsorted.length} items</div>
        </div>
        <div className="flex flex-wrap gap-2">
          {unsorted.map((id) => (
            <button
              key={id}
              draggable
              onDragStart={(e) => onDragStart(e, id)}
              className={`tab-chip smooth px-3 py-1.5 text-xs ${dragId === id ? "opacity-60 scale-[.98]" : ""}`}
              title={capsules[id]?.title}
            >
              {capsules[id]?.title}
            </button>
          ))}
          {unsorted.length === 0 && <div className="text-xs opacity-50">No unsorted capsules</div>}
        </div>
      </section>
    </div>
  );
}