"use client";
import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/lib/data/NotesRepo";

type Props = { noteId: number; onSaved?: () => void; onDeleted?: () => void; };

export default function NoteEditor({ noteId, onSaved, onDeleted }: Props) {
  const qc = useQueryClient();
  const { data: note, isLoading, isError } = useQuery({
    queryKey: ["memo", noteId],
    queryFn: async () => {
      try { return await repo.get(noteId); }
      catch {
        const list = await repo.list();
        const hit = list.find(x => x.id === noteId);
        if (!hit) throw new Error("not found");
        return { ...hit, content: "" };
      }
    },
  });

  const [title, setTitle]   = useState("");
  const [content, setContent] = useState("");

  useEffect(() => {
    // { note, similar } 形式 or Note直返し両対応
    const n = (note && ("note" in note) ? note.note : note) as any;
    if (n) { setTitle(n.title ?? ""); setContent(n.content ?? ""); }
  }, [note]);

  const save = useMutation({
    mutationFn: async () => repo.update(noteId, { title, content }),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["memos"] }),
        qc.invalidateQueries({ queryKey: ["memo", noteId] }),
        qc.invalidateQueries({ queryKey: ["graph"] }),
      ]);
      onSaved?.();
    },
  });

  const del = useMutation({
    mutationFn: async () => repo.remove(noteId),
    onSuccess: async () => {
      await Promise.all([
        qc.invalidateQueries({ queryKey: ["memos"] }),
        qc.invalidateQueries({ queryKey: ["graph"] }),
      ]);
      onDeleted?.();
    },
  });

  if (isLoading) return <div style={S.wrap}>読み込み中…</div>;
  if (isError || !note) return <div style={S.wrap}>読み込みに失敗しました</div>;

  return (
    <div style={S.wrap}>
      <div style={S.header}>
        <input value={title} onChange={e=>setTitle(e.target.value)} placeholder="タイトル" style={S.title}/>
        <div style={{display:"flex",gap:8}}>
          <button onClick={()=>save.mutate()} disabled={save.isPending} style={S.primary}>
            {save.isPending ? "保存中…" : "保存"}
          </button>
          <button onClick={()=>del.mutate()} disabled={del.isPending} style={S.danger}>
            {del.isPending ? "削除中…" : "削除"}
          </button>
        </div>
      </div>
      <textarea value={content} onChange={e=>setContent(e.target.value)} placeholder="本文を入力..." style={S.textarea}/>
    </div>
  );
}

const S: Record<string, React.CSSProperties> = {
  wrap:{display:"grid",gap:12,padding:16},
  header:{display:"flex",gap:12,alignItems:"center",justifyContent:"space-between"},
  title:{flex:1,fontSize:18,padding:"8px 10px",border:"1px solid #e5e7eb",borderRadius:8},
  primary:{padding:"8px 12px",borderRadius:8,border:"1px solid #2563eb",background:"#2563eb",color:"#fff"},
  danger:{padding:"8px 12px",borderRadius:8,border:"1px solid #ef4444",background:"#fff",color:"#ef4444"},
  textarea:{minHeight:360,resize:"vertical",padding:12,border:"1px solid #e5e7eb",borderRadius:8,fontFamily:"-apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Helvetica,Arial,'Hiragino Kaku Gothic ProN',Meiryo,sans-serif"},
};
