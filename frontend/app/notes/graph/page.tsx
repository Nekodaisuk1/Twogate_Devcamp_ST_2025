
"use client";
import React, { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { repo } from "@/lib/data/NotesRepo";

import { useUiStore } from "@/lib/stores/useUiStore";
import GraphCanvas from "@/components/GraphCanvas";

export default function GraphPage() {
  const { search, setGraphResults, focusNoteId } = useUiStore();
  const graph = useQuery({ queryKey: ["graph"], queryFn: () => repo.graph() });
  const notes = useQuery({ queryKey: ["memos"], queryFn: () => repo.list() });

  useEffect(()=> {
    if (!notes.data || !graph.data) return;
    if (!search) { setGraphResults([]); return; }
    const q = search.toLowerCase();
    // Graph上に存在するノードだけを対象に
    const nodeIdSet = new Set(graph.data.nodes.map(n => n.id));
    setGraphResults(
      notes.data.filter(n => nodeIdSet.has(n.id) && n.title.toLowerCase().includes(q))
    );
  }, [notes.data, graph.data, search, setGraphResults]);

  useEffect(()=> {
    if (focusNoteId != null) {
      console.log("snap to node", focusNoteId);
    }
  }, [focusNoteId]);

  // 全ノート情報をwindowにセット（GraphCanvasで参照用）
  if (typeof window !== "undefined" && notes.data) {
    (window as any).__ALL_NOTES__ = notes.data;
  }
  return (
    <div style={{ height: "100%", display: "grid", gridTemplateRows: "28px 1fr", gap: 8, padding: 12 }}>
      <div style={{ color: "#6b7280", fontSize: 12 }}>リンクビュー（Graph）</div>
      <div style={{ border: "1px solid #e5e5e5", borderRadius: 12, overflow: "hidden", background: "#fff", minHeight: 360 }}>
        {graph.isLoading && <p style={{ padding: 12 }}>読み込み中…</p>}
        {graph.isError && <p style={{ padding: 12 }}>読み込み失敗</p>}
        {graph.data && <GraphCanvas data={graph.data} />}
      </div>
    </div>
  );
}
