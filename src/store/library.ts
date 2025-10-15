"use client";

import { create } from "zustand";
import { useMemo } from "react";
import { pickColorDeterministic } from "@/theme/palette"; // centralized pastel palette

export type Folder = {
  id: string;
  name: string;
  createdAt: number;
  // Hex color string from the centralized pastel palette
  color: string;
};

export type Capsule = {
  id: string;
  title: string;
  folderId: string | null; // null => Unsorted
  content: string;
  createdAt: number;
  updatedAt: number;
  // Hex color string derived from folder when inside a folder; null for unsorted
  color: string | null;
};

export type LibraryState = {
  folders: Folder[];
  capsules: Capsule[];
  activeCapsuleId: string | null;
  // mutation state for UX
  mutationsInFlight: number;
  isMutating: boolean;

  // actions
  addFolder: (name?: string) => string;
  renameFolder: (id: string, name: string) => void;
  removeFolder: (id: string) => void;

  addCapsule: (title?: string, folderId?: string | null) => string;
  updateCapsule: (id: string, payload: Partial<Pick<Capsule, "title" | "content" | "folderId">>) => void;
  removeCapsule: (id: string) => void;
  // New: commit server-issued ID for a newly created capsule
  commitCapsuleId: (tempId: string, realId: string) => void;

  moveCapsuleToFolder: (capsuleId: string, folderId: string | null) => void;

  setActiveCapsule: (id: string | null) => void;
  beginMutation: () => void;
  endMutation: () => void;
};

function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

const initialDoc = `# Welcome to Snipply\n\nStart writing your documentation in Markdown.\n\n- Use the right sidebar to organize docs into folders.\n- Click a capsule to open it here.\n\n## Tips\n- Supports GitHub Flavored Markdown (tables, checklists).\n- Use the toolbar to insert common syntax.\n`;

export const useLibraryStore = create<LibraryState>()((set, get) => ({
      folders: [],
      capsules: [
        {
          id: uid("cap"),
          title: "Getting Started",
          folderId: null,
          content: initialDoc,
          createdAt: Date.now(),
          updatedAt: Date.now(),
          color: null,
        },
      ],
      activeCapsuleId: null,
      mutationsInFlight: 0,
      isMutating: false,

      addFolder: (name = "New Folder") => {
        const id = uid("fld");
        const folder: Folder = { id, name, createdAt: Date.now(), color: pickColorDeterministic(id) };
        set((s) => ({ folders: [folder, ...s.folders] }));
        return id;
      },

      renameFolder: (id, name) =>
        set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)) })),

      removeFolder: (id) =>
        set((s) => ({
          folders: s.folders.filter((f) => f.id !== id),
          capsules: s.capsules.map((c) => (c.folderId === id ? { ...c, folderId: null, color: null } : c)),
        })),

      addCapsule: (title = "Untitled", folderId: string | null = null) => {
        const id = uid("cap");
        const s = get();
        const folderColor: string | null = folderId ? (s.folders.find((f) => f.id === folderId)?.color ?? null) : null;
        const cap: Capsule = {
          id,
          title,
          folderId,
          content: "",
          createdAt: Date.now(),
          updatedAt: Date.now(),
          color: folderColor,
        };
        set((s) => ({ capsules: [cap, ...s.capsules], activeCapsuleId: id }));
        return id;
      },

      updateCapsule: (id, payload) =>
        set((s) => ({
          capsules: s.capsules.map((c) =>
            c.id === id ? { ...c, ...payload, updatedAt: Date.now() } : c
          ),
        })),

      removeCapsule: (id) =>
        set((s) => ({
          capsules: s.capsules.filter((c) => c.id !== id),
          activeCapsuleId: s.activeCapsuleId === id ? null : s.activeCapsuleId,
        })),

      // New: replace temp capsule ID with server ID
      commitCapsuleId: (tempId, realId) =>
        set((s) => ({
          capsules: s.capsules.map((c) => (c.id === tempId ? { ...c, id: realId } : c)),
          activeCapsuleId: s.activeCapsuleId === tempId ? realId : s.activeCapsuleId,
        })),

      moveCapsuleToFolder: (capsuleId, folderId) =>
        set((s) => {
          const destColor: string | null = folderId ? (s.folders.find((f) => f.id === folderId)?.color ?? null) : null;
          return {
            capsules: s.capsules.map((c) =>
              c.id === capsuleId
                ? { ...c, folderId, color: destColor, updatedAt: Date.now() }
                : c
            ),
          };
        }),

      setActiveCapsule: (id) => set({ activeCapsuleId: id }),
      beginMutation: () => set((s) => ({ mutationsInFlight: s.mutationsInFlight + 1, isMutating: true })),
      endMutation: () =>
        set((s) => {
          const next = Math.max(0, s.mutationsInFlight - 1);
          return { mutationsInFlight: next, isMutating: next > 0 };
        }),
}));

export function useActiveCapsule(): Capsule | null {
  const activeId = useLibraryStore((s) => s.activeCapsuleId);
  const capsules = useLibraryStore((s) => s.capsules);
  return useMemo(() => {
    return activeId ? capsules.find((c) => c.id === activeId) ?? null : null;
  }, [activeId, capsules]);
}