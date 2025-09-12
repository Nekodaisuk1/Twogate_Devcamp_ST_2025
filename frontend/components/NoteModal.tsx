
"use client";
import React, { useEffect, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/lib/data/NotesRepo";
import type { Note } from "@/lib/types";

export default function NoteModal({ noteId, open, onClose }: { noteId?: number; open: boolean; onClose: ()=>void; }) {
  const qc = useQueryClient();
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    (async () => {
      if (!noteId) return;
      try {
        const data = await repo.get(noteId);
        if (data?.note) {
          setTitle(data.note.title || "");
          setContent(data.note.content || "");
        }
      } catch {}
    })();
  }, [noteId]);

  const saveMut = useMutation({
    mutationFn: async () => {
      if (!noteId) return;
      return repo.update(noteId, { title, content });
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["memos"] }); onClose(); },
  });

  const delMut = useMutation({
    mutationFn: async () => {
      if (!noteId) return;
      await repo.remove(noteId);
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["memos"] }); onClose(); },
  });

  if (!open) return null;

  return (
    <div role="dialog" aria-modal="true" style={styles.backdrop} onClick={onClose}>
      <div style={styles.modal} onClick={(e) => e.stopPropagation()}>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          <input value={title} onChange={(e)=> setTitle(e.target.value)} placeholder="タイトル" style={styles.input}/>
          <button onClick={onClose} style={styles.ghost}>閉じる</button>
        </div>
        <textarea value={content} onChange={(e)=> setContent(e.target.value)} placeholder="本文" style={styles.textarea}/>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button onClick={()=> saveMut.mutate()} disabled={!noteId} style={styles.primary}>保存</button>
          <button onClick={()=> delMut.mutate()} disabled={!noteId} style={styles.danger}>削除</button>
        </div>
      </div>
    </div>
  );
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: { position: "fixed", inset: 0, background: "rgba(0,0,0,.35)", display: "grid", placeItems: "center", zIndex: 50 },
  modal: { width: "min(720px, 92vw)", background: "#fff", borderRadius: 12, border: "1px solid #e5e5e5", padding: 16, display: "grid", gap: 12 },
  input: { flex: "1 1 auto", border: "1px solid #e5e5e5", borderRadius: 8, padding: "8px 10px" },
  textarea: { minHeight: 240, border: "1px solid #e5e5e5", borderRadius: 8, padding: 10, resize: "vertical" },
  ghost: { border: "1px solid #e5e5e5", borderRadius: 8, padding: "6px 10px", background: "#fff" },
  primary: { border: "1px solid #111827", background: "#111827", color: "#fff", borderRadius: 8, padding: "6px 12px" },
  danger: { border: "1px solid #ef4444", background: "#ef4444", color: "#fff", borderRadius: 8, padding: "6px 12px" },
};
