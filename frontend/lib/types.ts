
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
