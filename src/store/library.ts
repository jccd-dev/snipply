"use client";

import { create } from "zustand";
import { useMemo } from "react";
import { pickColorDeterministic } from "@/theme/palette"; // centralized pastel palette

// Add lightweight localStorage persistence for custom orders
const ORDERS_STORAGE_KEY = "snipply_orders_v1";
function loadOrders(): { folders: string[]; capsules: Record<string, string[]> } {
  if (typeof window === "undefined") return { folders: [], capsules: {} };
  try {
    const raw = localStorage.getItem(ORDERS_STORAGE_KEY);
    if (!raw) return { folders: [], capsules: {} };
    const parsed = JSON.parse(raw);
    const folders = Array.isArray(parsed?.folders) ? parsed.folders : [];
    const capsules = parsed && typeof parsed.capsules === "object" ? parsed.capsules : {};
    return { folders, capsules };
  } catch {
    return { folders: [], capsules: {} };
  }
}
function saveOrders(folders: string[], capsules: Record<string, string[]>) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(ORDERS_STORAGE_KEY, JSON.stringify({ folders, capsules }));
  } catch {
    // ignore quota errors
  }
}
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
  // local-only folders pending server sync
  pendingFolderIds: string[];
  // Custom ordering state (client-side)
  customFolderOrder: string[];
  customCapsuleOrder: Record<string, string[]>; // key: folderId or 'unsorted'

  // actions
  addFolder: (name?: string) => string;
  renameFolder: (id: string, name: string) => void;
  removeFolder: (id: string) => void;
  markFolderPending: (id: string) => void;
  clearFolderPending: (id: string) => void;
  reorderFolder: (sourceId: string, targetId: string, position?: "before" | "after") => void;

  addCapsule: (title?: string, folderId?: string | null) => string;
  updateCapsule: (id: string, payload: Partial<Pick<Capsule, "title" | "content" | "folderId">>) => void;
  removeCapsule: (id: string) => void;
  // New: commit server-issued ID for a newly created capsule
  commitCapsuleId: (tempId: string, realId: string) => void;
  reorderCapsuleInFolder: (folderId: string | null, sourceId: string, targetId: string, position?: "before" | "after") => void;

  moveCapsuleToFolder: (capsuleId: string, folderId: string | null) => void;

  setActiveCapsule: (id: string | null) => void;
  beginMutation: () => void;
  endMutation: () => void;
};

function uid(prefix = "id"): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 9)}${Date.now().toString(36).slice(-3)}`;
}

function folderKey(id: string | null): string {
  return id ?? "unsorted";
}

// Prepare initial orders from localStorage
const __initialOrders = loadOrders();

export const useLibraryStore = create<LibraryState>()((set, get) => ({
      folders: [],
      capsules: [],
      activeCapsuleId: null,
      mutationsInFlight: 0,
      isMutating: false,
      pendingFolderIds: [],
      customFolderOrder: __initialOrders.folders,
      customCapsuleOrder: __initialOrders.capsules,

      addFolder: (name = "New Folder") => {
        const id = uid("fld");
        const folder: Folder = { id, name, createdAt: Date.now(), color: pickColorDeterministic(id) };
        set((s) => {
          const nextOrder = [id, ...s.customFolderOrder];
          saveOrders(nextOrder, s.customCapsuleOrder);
          return { folders: [folder, ...s.folders], customFolderOrder: nextOrder };
        });
        return id;
      },

      renameFolder: (id, name) =>
        set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)) })),

      removeFolder: (id) =>
        set((s) => {
          const { [id]: _, ...restOrder } = s.customCapsuleOrder;
          const nextFolderOrder = s.customFolderOrder.filter((fid) => fid !== id);
          saveOrders(nextFolderOrder, restOrder);
          return {
            folders: s.folders.filter((f) => f.id !== id),
            capsules: s.capsules.map((c) => (c.folderId === id ? { ...c, folderId: null, color: null } : c)),
            pendingFolderIds: s.pendingFolderIds.filter((fid) => fid !== id),
            customFolderOrder: nextFolderOrder,
            customCapsuleOrder: restOrder,
          };
        }),

      markFolderPending: (id) =>
        set((s) => (s.pendingFolderIds.includes(id) ? s : { pendingFolderIds: [id, ...s.pendingFolderIds] })),
      clearFolderPending: (id) =>
        set((s) => ({ pendingFolderIds: s.pendingFolderIds.filter((fid) => fid !== id) })),

      reorderFolder: (sourceId, targetId, position = "before") =>
        set((s) => {
          const base = s.customFolderOrder.length
            ? s.customFolderOrder.slice()
            : s.folders.slice().sort((a, b) => b.createdAt - a.createdAt).map((f) => f.id);
          const filtered = base.filter((id) => id !== sourceId);
          const idx = filtered.indexOf(targetId);
          let insertAt = 0;
          if (idx >= 0) {
            insertAt = position === "after" ? idx + 1 : idx;
          } else {
            insertAt = position === "after" ? filtered.length : 0;
          }
          filtered.splice(insertAt, 0, sourceId);
          saveOrders(filtered, s.customCapsuleOrder);
          return { customFolderOrder: filtered };
        }),

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
        const key = folderKey(folderId);
        const prevOrder = s.customCapsuleOrder[key] ?? [];
        set((s2) => {
          const nextCapsOrder = { ...s2.customCapsuleOrder, [key]: [id, ...prevOrder] };
          saveOrders(s2.customFolderOrder, nextCapsOrder);
          return {
            capsules: [cap, ...s2.capsules],
            activeCapsuleId: id,
            customCapsuleOrder: nextCapsOrder,
          };
        });
        return id;
      },

      updateCapsule: (id, payload) =>
        set((s) => ({
          capsules: s.capsules.map((c) =>
            c.id === id ? { ...c, ...payload, updatedAt: Date.now() } : c
          ),
        })),

      removeCapsule: (id) =>
        set((s) => {
          const newOrder = Object.fromEntries(
            Object.entries(s.customCapsuleOrder).map(([k, arr]) => [k, arr.filter((cid) => cid !== id)])
          );
          saveOrders(s.customFolderOrder, newOrder);
          return {
            capsules: s.capsules.filter((c) => c.id !== id),
            activeCapsuleId: s.activeCapsuleId === id ? null : s.activeCapsuleId,
            customCapsuleOrder: newOrder,
          };
        }),

      // New: replace temp capsule ID with server ID
      commitCapsuleId: (tempId, realId) =>
        set((s) => {
          const nextCapsOrder = Object.fromEntries(
            Object.entries(s.customCapsuleOrder).map(([k, arr]) => [k, arr.map((cid) => (cid === tempId ? realId : cid))])
          );
          saveOrders(s.customFolderOrder, nextCapsOrder);
          return {
            capsules: s.capsules.map((c) => (c.id === tempId ? { ...c, id: realId } : c)),
            activeCapsuleId: s.activeCapsuleId === tempId ? realId : s.activeCapsuleId,
            customCapsuleOrder: nextCapsOrder,
          };
        }),

      reorderCapsuleInFolder: (folderId, sourceId, targetId, position = "before") =>
        set((s) => {
          const key = folderKey(folderId);
          const base = (s.customCapsuleOrder[key] ?? s.capsules.filter((c) => (c.folderId ?? null) === folderId).map((c) => c.id)).slice();
          const filtered = base.filter((id) => id !== sourceId);
          const idx = filtered.indexOf(targetId);
          let insertAt = 0;
          if (idx >= 0) {
            insertAt = position === "after" ? idx + 1 : idx;
          } else {
            insertAt = position === "after" ? filtered.length : 0;
          }
          filtered.splice(insertAt, 0, sourceId);
          const nextCapsOrder = { ...s.customCapsuleOrder, [key]: filtered };
          saveOrders(s.customFolderOrder, nextCapsOrder);
          return { customCapsuleOrder: nextCapsOrder };
        }),

      moveCapsuleToFolder: (capsuleId, folderId) =>
        set((s) => {
          const destColor: string | null = folderId ? (s.folders.find((f) => f.id === folderId)?.color ?? null) : null;
          const prev = s.capsules.find((c) => c.id === capsuleId);
          const prevKey = folderKey(prev?.folderId ?? null);
          const nextKey = folderKey(folderId);
          const removedPrev = (s.customCapsuleOrder[prevKey] ?? []).filter((cid) => cid !== capsuleId);
          const nextArr = [capsuleId, ...(s.customCapsuleOrder[nextKey] ?? [])];
          const nextCapsOrder = { ...s.customCapsuleOrder, [prevKey]: removedPrev, [nextKey]: nextArr };
          saveOrders(s.customFolderOrder, nextCapsOrder);
          return {
            capsules: s.capsules.map((c) =>
              c.id === capsuleId
                ? { ...c, folderId, color: destColor, updatedAt: Date.now() }
                : c
            ),
            customCapsuleOrder: nextCapsOrder,
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