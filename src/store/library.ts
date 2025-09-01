"use client";

import { create } from "zustand";
import { persist } from "zustand/middleware";
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

  // actions
  addFolder: (name?: string) => string;
  renameFolder: (id: string, name: string) => void;
  removeFolder: (id: string) => void;

  addCapsule: (title?: string, folderId?: string | null) => string;
  updateCapsule: (id: string, payload: Partial<Pick<Capsule, "title" | "content" | "folderId">>) => void;
  removeCapsule: (id: string) => void;

  moveCapsuleToFolder: (capsuleId: string, folderId: string | null) => void;

  setActiveCapsule: (id: string | null) => void;
};

function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

const initialDoc = `# Welcome to Snipply\n\nStart writing your documentation in Markdown.\n\n- Use the right sidebar to organize docs into folders.\n- Click a capsule to open it here.\n\n## Tips\n- Supports GitHub Flavored Markdown (tables, checklists).\n- Use the toolbar to insert common syntax.\n`;

export const useLibraryStore = create<LibraryState>()(
  persist(
    (set, get) => ({
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
    }),
    {
      name: "snipply-library",
      partialize: (state) => ({
        folders: state.folders,
        capsules: state.capsules,
        activeCapsuleId: state.activeCapsuleId,
      }),
      version: 2,
      migrate: (persisted: any, fromVersion: number) => {
        if (!persisted) return persisted;
        if (fromVersion < 2) {
          const folders = Array.isArray(persisted.folders)
            ? persisted.folders.map((f: any) => ({
                id: f.id,
                name: f.name,
                createdAt: f.createdAt,
                color: pickColorDeterministic(f.id),
              }))
            : [];
          const capsules = Array.isArray(persisted.capsules)
            ? persisted.capsules.map((c: any) => ({
                id: c.id,
                title: c.title,
                folderId: c.folderId ?? null,
                content: c.content ?? "",
                createdAt: c.createdAt ?? Date.now(),
                updatedAt: c.updatedAt ?? Date.now(),
                color: c.folderId ? pickColorDeterministic(c.folderId) : null,
              }))
            : [];
          return { ...persisted, folders, capsules };
        }
        return persisted;
      },
    }
  )
);

export function useActiveCapsule(): Capsule | null {
  const activeId = useLibraryStore((s) => s.activeCapsuleId);
  const capsules = useLibraryStore((s) => s.capsules);
  return useMemo(() => {
    return activeId ? capsules.find((c) => c.id === activeId) ?? null : null;
  }, [activeId, capsules]);
}