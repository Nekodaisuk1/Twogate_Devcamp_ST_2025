
import "./globals.css";
import Providers from "./(providers)/providers";
import Sidebar from "@/components/Sidebar";
import Topbar from "@/components/Topbar";
import React from "react";

export const metadata = { title: "Linked Notes", description: "Notes with links" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ja">
      <body>
        <Providers>
          <div style={{display:"grid", gridTemplateColumns:"260px 1fr", gridTemplateRows:"56px 1fr", height:"100dvh"}}>
            <aside style={{gridColumn:"1", gridRow:"1 / span 2", borderRight:"1px solid #e5e5e5", background:"#fff", overflow:"hidden"}}>
              <Sidebar />
            </aside>
            <header style={{gridColumn:"2", gridRow:"1"}}>
              <Topbar />
            </header>
            <main style={{gridColumn:"2", gridRow:"2", overflow:"auto"}}>{children}</main>
          </div>
        </Providers>
      </body>
    </html>
  );
}
