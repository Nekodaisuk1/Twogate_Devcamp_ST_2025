"use client";
import React from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import NoteEditor from "@/components/NoteEditor";

export default function NoteEditPage() {
  const { id } = useParams<{id:string}>();
  const router = useRouter();
  const sp = useSearchParams();
  const noteId = Number(id);
  const from = sp.get("from") ?? "grid"; // 既定は grid

  const goBack = () => router.push(from === "graph" ? "/notes/graph" : "/notes/grid");

  return (
    <div style={{height:"100%",display:"grid",gridTemplateRows:"48px 1fr"}}>
      <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",borderBottom:"1px solid #eee"}}>
        <button onClick={goBack} style={btn}>← 戻る</button>
        <div style={{color:"#6b7280",fontSize:12}}>ノート編集</div>
      </div>
      <div style={{overflow:"auto"}}>
        <NoteEditor noteId={noteId} onSaved={()=>{}} onDeleted={goBack}/>
      </div>
    </div>
  );
}
const btn:React.CSSProperties={padding:"6px 10px",borderRadius:8,border:"1px solid #e5e7eb",background:"#fff",cursor:"pointer"};
