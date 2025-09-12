
"use client";
import React from "react";
import type { Note } from "@/lib/types";
import { formatJP } from "@/lib/date";

export default function NoteCard({ note, datePref, onClick }: { note: Note; datePref: "updated"|"created"; onClick?: ()=>void }) {
  const dateISO = datePref === "updated" ? note.accessed_at : note.created_date;
  const label = datePref === "updated" ? "更新" : "作成";
  return (
    <article onClick={onClick} style={styles.card} role="button">
      <h3 style={{ margin: "0 0 8px", fontSize: 16, lineHeight: "20px" }}>{note.title}</h3>
      <p style={{ margin: 0, color: "#6b7280", fontSize: 12 }}>
        {label}: {formatJP(dateISO)}
      </p>
      {note.preview && <p style={{ margin: "8px 0 0", color: "#374151", fontSize: 13 }}>{note.preview}</p>}
    </article>
  );
}

const styles: Record<string, React.CSSProperties> = {
  card: { border: "1px solid #e5e5e5", borderRadius: 10, padding: 12, background: "#fff", cursor: "pointer" },
};
