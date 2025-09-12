
"use client";
import React from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUiStore } from "@/lib/stores/useUiStore";

export default function Topbar() {
  const router = useRouter();
  const path = usePathname();
  const { search, setSearch, datePref, setDatePref } = useUiStore();
  const isGraph = path.startsWith("/notes/graph");
  const isGrid = path.startsWith("/notes/grid");

  return (
    <div style={{height:56, display:"flex", alignItems:"center", gap:12, padding:"0 16px", borderBottom:"1px solid #e5e5e5", background:"#fff"}}>
      <input
        value={search}
        onChange={(e)=> setSearch(e.target.value)}
        placeholder={isGraph ? "検索（Graph：結果はサイドバー）" : "検索（Grid：絞り込み）"}
        style={{flex: "1 1 480px", maxWidth: 640, minWidth: 160, height: 36, borderRadius: 9999, border:"1px solid #e5e5e5", padding:"0 12px"}}
      />

      <div style={{display:"flex", gap:8}}>
        <button onClick={()=> router.push("/notes/graph")} style={{padding:"6px 10px", borderRadius:8, border:"1px solid #e5e5e5", background: isGraph ? "#111827" : "#f5f5f5", color: isGraph ? "#fff" : "#111"}}>リンク</button>
        <button onClick={()=> router.push("/notes/grid")}  style={{padding:"6px 10px", borderRadius:8, border:"1px solid #e5e5e5", background: isGrid ? "#111827" : "#f5f5f5", color: isGrid ? "#fff" : "#111"}}>整列</button>
      </div>

      <label style={{marginLeft:"auto", fontSize:12, color:"#6b7280"}}>日付表示:</label>
      <select
        value={datePref}
        onChange={(e)=> setDatePref(e.target.value as any)}
        style={{border:"1px solid #e5e5e5", borderRadius:6, padding:"4px 8px"}}
      >
        <option value="updated">更新日</option>
        <option value="created">作成日</option>
      </select>
    </div>
  );
}
