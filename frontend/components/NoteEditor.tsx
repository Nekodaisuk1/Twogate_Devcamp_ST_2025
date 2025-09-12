"use client";
import React, { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { repo } from "@/lib/data/NotesRepo";
import { useUiStore } from "@/lib/stores/useUiStore";

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
  const [selectedSection, setSelectedSection] = useState<string>("");

  // セクション一覧と追加アクション
  const sections = useUiStore(s => s.sections);
  const addItemToSection = useUiStore(s => s.addItemToSection);

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

      {/* セクション追加UI */}
      {sections.length > 0 && (
        <div style={{display:"flex", gap:8, alignItems:"center", marginBottom:8}}>
          <select
            value={selectedSection}
            onChange={e => setSelectedSection(e.target.value)}
            style={{padding:"6px 10px", borderRadius:6, border:"1px solid #e5e7eb"}}
          >
            <option value="">セクションを選択</option>
            {sections.map(sec => (
              <option key={sec.sectionId} value={sec.sectionId}>{sec.title}</option>
            ))}
          </select>
          <button
            style={{padding:"6px 12px", borderRadius:6, border:"1px solid #2563eb", background:"#2563eb", color:"#fff"}}
            disabled={!selectedSection}
            onClick={() => {
              if (!selectedSection) return;
              addItemToSection(selectedSection, {
                id: noteId,
                title,
                // 必要なら日付やmetaも追加可能
              });
              setSelectedSection("");
              window.alert("セクションに追加しました");
            }}
          >
            セクションに追加
          </button>
        </div>
      )}

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
