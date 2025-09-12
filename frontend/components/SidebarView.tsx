"use client";
import React from "react";
import styles from "./SidebarView.module.css";

export type SidebarItem = { id: number; title: string; dateISO?: string; dateLabel?: string; meta?: string };
export type CustomSection = { sectionId: string; title: string; items: SidebarItem[] };

type Props = {
  timeISO: string;
  timeLabel: string;
  showSearch: boolean;
  searchResults: SidebarItem[];
  recentNotes: SidebarItem[];
  favorites: SidebarItem[];
  showFavorites: boolean;
  sections: CustomSection[];
  collapsedMap: Record<string, boolean>;
  onClickItem?: (id: number) => void;
  onToggleSection?: (key: string) => void;
  onAddSection?: () => void;
};

export default function SidebarView(props: Props) {
  const {
    timeISO, timeLabel, showSearch, searchResults, recentNotes, favorites, showFavorites, sections,
    collapsedMap, onClickItem, onToggleSection, onAddSection
  } = props;

  return (
    <div className={styles.wrap}>
      <div className={styles.header}>
        <div className={styles.time}>
      <time dateTime={timeISO} suppressHydrationWarning>{timeLabel}</time>
        </div>
        <div className={styles.sb_line} />
      </div>

      <nav className={styles.nav}>
        {showSearch && (
          <Section
            title="検索結果"
            right={searchResults.length ? String(searchResults.length) : "0"}
            collapsed={!!collapsedMap["search"]}
            onToggle={() => onToggleSection?.("search")}
          >
            {searchResults.length ? (
              searchResults.map(it => (
                <Row key={it.id} title={it.title} meta={it.meta} onClick={() => onClickItem?.(it.id)} />
              ))
            ) : (
              <Empty label="該当なし" />
            )}
          </Section>
        )}

        <Section
          title="閲覧履歴"
          right={recentNotes.length ? String(recentNotes.length) : "0"}
          collapsed={!!collapsedMap["recent"]}
          onToggle={() => onToggleSection?.("recent")}
        >
          {recentNotes.map(it => (
            <Row key={it.id} title={it.title} meta={it.meta} onClick={() => onClickItem?.(it.id)} />
          ))}
        </Section>

        {showFavorites && (
          <Section
            title="お気に入り"
            right={favorites.length ? String(favorites.length) : "0"}
            collapsed={!!collapsedMap["favorites"]}
            onToggle={() => onToggleSection?.("favorites")}
          >
            {favorites.map(it => (
              <Row key={it.id} title={it.title} meta={it.meta} onClick={() => onClickItem?.(it.id)} />
            ))}
          </Section>
        )}

        {sections.map(sec => (
          <Section
            key={sec.sectionId}
            title={sec.title}
            right={String(sec.items.length)}
            collapsed={!!collapsedMap[sec.sectionId]}
            onToggle={() => onToggleSection?.(sec.sectionId)}
          >
            {sec.items.map(it => (
              <Row key={it.id} title={it.title} meta={it.meta} onClick={() => onClickItem?.(it.id)} />
            ))}
          </Section>
        ))}
      </nav>

      <footer className={styles.footer}>
        <button className={styles.addBtn} onClick={onAddSection}>＋ セクション追加</button>
      </footer>
    </div>
  );
}

function Section(props: { title: string; right?: string; collapsed?: boolean; onToggle?: () => void; children?: React.ReactNode }) {
  const { title, right, collapsed, onToggle, children } = props;
  return (
    <section className={collapsed ? "is-collapsed" : ""}>
      <header className={styles.sectionHeader} onClick={onToggle} aria-expanded={!collapsed}>
        <span className={styles.chev}>{collapsed ? "▸" : "▾"}</span>
        <span className={styles.sectionTitle}>{title}</span>
        <span className={styles.count}>{right}</span>
      </header>
      {!collapsed && <div className={styles.items}>{children}</div>}
    </section>
  );
}

function Row(props: { title: string; meta?: string; onClick?: () => void }) {
  const { title, meta, onClick } = props;
  return (
    <div className={styles.row} onClick={onClick}>
      <div className={styles.rowTitle}>{title}</div>
      {meta && <div className={styles.rowMeta}>{meta}</div>}
    </div>
  );
}

function Empty({ label }: { label: string }) {
  return <div className={styles.empty}>{label}</div>;
}
