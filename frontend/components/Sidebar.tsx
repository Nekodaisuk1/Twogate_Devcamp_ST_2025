
"use client";
import React from "react";
import SidebarView from "@/components/SidebarView";
import { useQuery } from "@tanstack/react-query";
import { repo } from "@/lib/data/NotesRepo";
import { useUiStore } from "@/lib/stores/useUiStore";
import { isoNowJP } from "@/lib/date";

import { usePathname, useRouter } from "next/navigation";

export default function Sidebar() {

  const { search, graphResults, collapsed, setFocus, toggleSection, sections, addSection } = useUiStore();
  const { data: recent = [] } = useQuery({ queryKey: ["memos"], queryFn: () => repo.list() });
  const { iso: timeISO, label: timeLabel } = isoNowJP();
  const pathname = usePathname();
  const router = useRouter();

  // セクション追加時に名前を入力して追加
  const handleAddSection = () => {
    const title = window.prompt("新しいセクション名を入力してください", "新しいセクション");
    if (title && title.trim()) {
      addSection(title.trim());
    }
  };

  // ノートクリック時の挙動
  const handleClickItem = (id: number) => {
    setFocus(id);
    // grid画面ならノート編集画面に遷移
    if (pathname && pathname.startsWith("/notes/grid")) {
      router.push(`/notes/${id}?from=grid`);
    }
  };

  return (
    <SidebarView
      timeISO={timeISO}
      timeLabel={timeLabel}
      showSearch={!!search}
      searchResults={graphResults.map(n=>({ id: n.id, title: n.title }))}
      recentNotes={recent.map(n=>({ id: n.id, title: n.title }))}
      favorites={[]}
      showFavorites={false}
      sections={sections}
      collapsedMap={collapsed}
      onClickItem={handleClickItem}
      onToggleSection={(key)=> toggleSection(key)}
      onAddSection={handleAddSection}
    />
  );
}
