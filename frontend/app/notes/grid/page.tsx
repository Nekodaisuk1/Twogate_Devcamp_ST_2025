
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
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const router = useRouter();

  const notesQuery = useQuery({ queryKey: ["memos"], queryFn: () => repo.list() });

  const createMut = useMutation({
    mutationFn: () => repo.create({ title, content }),
    onSuccess: () => { setTitle(""); setContent(""); qc.invalidateQueries({ queryKey: ["memos"] }); },
  });

  const filtered = useMemo(() => {
    const list = notesQuery.data ?? [];
    if (!search) return list;
    const q = search.toLowerCase();
    return list.filter(n => n.title.toLowerCase().includes(q));
  }, [notesQuery.data, search]);

  function openEditPage(id: number) { router.push(`/notes/${id}?from=grid`); }

  return (
    <div style={{ padding: 16 }}>
  <h2>ノート</h2>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: 8, marginBottom: 12, alignItems: "center" }}>
        <input value={title} onChange={(e)=> setTitle(e.target.value)} placeholder="タイトル" style={{ border: "1px solid #e5e5e5", borderRadius: 6, padding: "6px 8px" }}/>
        <input value={content} onChange={(e)=> setContent(e.target.value)} placeholder="本文（任意）" style={{ border: "1px solid #e5e5e5", borderRadius: 6, padding: "6px 8px" }}/>
        <button onClick={()=> createMut.mutate()} disabled={!title}>作成</button>
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
