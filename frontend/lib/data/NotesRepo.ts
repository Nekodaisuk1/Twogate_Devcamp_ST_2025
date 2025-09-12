
import { api } from "@/lib/api";
import type { Note, GraphPayload } from "@/lib/types";

export interface NotesRepo {
  list(): Promise<Note[]>;
  get(id: number): Promise<{ note: Note | null; similar: { similarity_memo_id: number; similarity_score: number }[] }>;
  create(input: { title: string; content?: string }): Promise<Note>;
  update(id: number, patch: Partial<Pick<Note, "title" | "content">>): Promise<{ ok: boolean } | Note>;
  remove(id: number): Promise<{ ok: boolean }>;
  search(q: string): Promise<Note[]>;
  graph(): Promise<GraphPayload>;
}

export const repo: NotesRepo = {
  list: () => api<Note[]>("/api/memos"),
  get: (id) => api(`/api/memos/${id}`),
  create: (input) => api("/api/memos", { method: "POST", body: JSON.stringify({ content: "", ...input }) }),
  update: (id, patch) => api(`/api/memos/${id}`, { method: "PATCH", body: JSON.stringify(patch) }),
  remove: async (id) => api(`/api/memos/${id}`, { method: "DELETE" }),
  search: (q) => api(`/api/search?q=${encodeURIComponent(q)}`),
  graph: () => api("/api/graph"),
};
