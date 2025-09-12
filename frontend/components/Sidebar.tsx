
"use client";
import React from "react";
import SidebarView from "@/components/SidebarView";
import { useQuery } from "@tanstack/react-query";
import { repo } from "@/lib/data/NotesRepo";
import { useUiStore } from "@/lib/stores/useUiStore";
import { isoNowJP } from "@/lib/date";

export default function Sidebar() {
  const { search, graphResults, collapsed, setFocus, toggleSection } = useUiStore();
  const { data: recent = [] } = useQuery({ queryKey: ["memos"], queryFn: () => repo.list() });

  const { iso: timeISO, label: timeLabel } = isoNowJP();

  return (
    <SidebarView
      timeISO={timeISO}
      timeLabel={timeLabel}
      showSearch={!!search}
      searchResults={graphResults.map(n=>({ id: n.id, title: n.title }))}
      recentNotes={recent.map(n=>({ id: n.id, title: n.title }))}
      favorites={[]}
      showFavorites={false}
      sections={[]}
      collapsedMap={collapsed}
      onClickItem={(id)=> setFocus(id)}
      onToggleSection={(key)=> toggleSection(key)}
      onAddSection={()=>{/* later */}}
    />
  );
}
