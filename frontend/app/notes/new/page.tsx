"use client";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/lib/data/NotesRepo";
import NoteEditor from "@/components/NoteEditor";

export default function NoteNewPage() {
  const router = useRouter();
  const qc = useQueryClient();
  const [createdId, setCreatedId] = useState<number|null>(null);

  const createMut = useMutation({
    mutationFn: async () => {
      const note = await repo.create({ title: "", content: "" });
      return note;
    },
    onSuccess: (note) => {
      setCreatedId(note.id);
      qc.invalidateQueries({ queryKey: ["memos"] });
    },
  });

  // 作成直後はそのノートの編集画面にリダイレクト
  React.useEffect(() => {
    if (createdId) {
      router.replace(`/notes/${createdId}?from=grid`);
    }
  }, [createdId, router]);

  return (
    <div style={{height:"100%",display:"grid",gridTemplateRows:"48px 1fr"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderBottom:"1px solid #eee"}}>
        <button onClick={()=>router.push("/notes/grid")}>← 戻る</button>
        <div style={{color:"#6b7280",fontSize:12}}>ノート新規作成</div>
      </div>
      <div style={{overflow:"auto",padding:16}}>
        <button
          style={{padding:"10px 20px",borderRadius:8,background:"#2563eb",color:"#fff",border:"none",fontSize:16}}
          onClick={()=>createMut.mutate()}
          disabled={createMut.isPending}
        >
          {createMut.isPending ? "作成中..." : "空ノートを作成して編集"}
        </button>
      </div>
    </div>
  );
}
