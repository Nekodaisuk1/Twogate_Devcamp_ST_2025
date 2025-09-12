// サイドバーのカスタムセクション用型
export type SidebarItem = { id: number; title: string; dateISO?: string; dateLabel?: string; meta?: string };
export type CustomSection = { sectionId: string; title: string; items: SidebarItem[] };

export type Note = {
  id: number;
  title: string;
  created_date: string;
  accessed_at: string;
  content?: string;
  preview?: string;
};

export type DatePref = "updated" | "created";

export type GraphNode = { id: number; title?: string };
export type GraphEdge = { source: number; target: number; score?: number };
export type GraphPayload = { nodes: GraphNode[]; edges: GraphEdge[] };
