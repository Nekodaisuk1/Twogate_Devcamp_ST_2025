

"use client";
import React, { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/lib/data/NotesRepo";
import { useUiStore } from "@/lib/stores/useUiStore";
import NoteCard from "@/components/NoteCard";

import { useRouter } from "next/navigation";
import type { Note } from "@/lib/types";

export default function GridPage() {
  const qc = useQueryClient();
  const { search, datePref } = useUiStore();
  // 入力フォームは不要
  const router = useRouter();

  const notesQuery = useQuery({ queryKey: ["memos"], queryFn: () => repo.list() });



  const filtered = useMemo(() => {
    const list = notesQuery.data ?? [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(n => n.title.toLowerCase().includes(q));
  }, [notesQuery.data, search]);

  function openEditPage(id: number) { router.push(`/notes/${id}?from=grid`); }


  // 新規ノート作成ボタン用
  const createMut = useMutation({
    mutationFn: async () => {
      const note = await repo.create({ title: "新しいノート", content: "メモを入力してください" });
      return note;
    },
    onSuccess: (note) => {
      qc.invalidateQueries({ queryKey: ["memos"] });
      router.push(`/notes/${note.id}?from=grid`);
    },
  });

  return (
    <div style={{ padding: 16 }}>
  {/* <h2>ノート</h2> */}
      <div style={{ marginBottom: 16 }}>
        <button
          style={{ padding: "10px 20px", borderRadius: 8, background: "#2563eb", color: "#fff", border: "none", fontSize: 16 }}
          onClick={() => createMut.mutate()}
          disabled={createMut.isPending}
        >
          {createMut.isPending ? "作成中..." : "ノートを新規作成"}
        </button>
      </div>
      {notesQuery.isLoading ? <p>読み込み中…</p> : null}
      {notesQuery.isError ? <p>読み込み失敗</p> : null}
      <ul style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))", gap: 12, listStyle: "none", padding: 0 }}>
        {filtered.map((n: Note)=> (
          <li key={n.id}>
            <NoteCard note={n} datePref={datePref} onClick={()=> openEditPage(n.id)} />
          </li>
        ))}
      </ul>
    </div>
  );
}
