"use client";
import React, { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import { formatJP } from "@/lib/date";
import type { Note } from "@/lib/types";
import type { GraphPayload } from "@/lib/types";
import { useUiStore } from "@/lib/stores/useUiStore";
import { useRouter } from "next/navigation";

const NODE_W = 140;
const NODE_H = 60;
const NODE_R = Math.hypot(NODE_W / 2, NODE_H / 2);

/**
 * 高速 Canvas グラフ（d3-force）
 * - ホイール：ズーム、ドラッグ：パン
 * - ノードドラッグ：一時固定、ダブルクリック：固定解除
 * - 検索結果（緑）・フォーカス（青）をハイライト
 * - Sidebar からの focusNoteId 更新で中央にスナップ
 */
export default function GraphCanvas({
  data,
  width,
  height,
}: {
  data: GraphPayload; // { nodes:[{id,title?}], edges:[{source,target,score?}]} 互換: links/value も対応
  width?: number;
  height?: number;
}) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const transformRef = useRef(d3.zoomIdentity);
  const simRef = useRef<d3.Simulation<any, any> | null>(null);

  const { graphResults, focusNoteId, setFocus, datePref } = useUiStore();
  const snapNodeIdRef = useRef<number|null>(null);
  const router = useRouter();

  // d3 が書き換えるためコピーを作る
  const { nodes, links } = useMemo(() => {
    const edges =
      (data as any).edges ??
      (data as any).links?.map((l: any) => ({ source: l.source, target: l.target, score: l.value })) ??
      [];

    // 連結成分ごとにグループ分け
  // x, y プロパティを持つ型で初期化
  const nodeMap = new Map(data.nodes.map(n => [n.id, { ...n, x: undefined as number|undefined, y: undefined as number|undefined }]));
    const visited = new Set();
    const groups: number[][] = [];
    function dfs(id: number, group: number[]) {
      if (visited.has(id)) return;
      visited.add(id);
      group.push(id);
      for (const e of edges) {
        if (e.source === id && !visited.has(e.target)) dfs(e.target as number, group);
        if (e.target === id && !visited.has(e.source)) dfs(e.source as number, group);
      }
    }
    for (const n of data.nodes) {
      if (!visited.has(n.id)) {
        const group: number[] = [];
        dfs(n.id, group);
        groups.push(group);
      }
    }

    // グループごとに中心をずらし、グループ内は円形に配置
    const R = 200; // グループ間距離
    const r = 40;  // グループ内半径
    groups.forEach((group, gi) => {
      const angle0 = (2 * Math.PI * gi) / groups.length;
      const cx = Math.cos(angle0) * R;
      const cy = Math.sin(angle0) * R;
      group.forEach((id, j) => {
        const theta = (2 * Math.PI * j) / group.length;
        const x = cx + Math.cos(theta) * r;
        const y = cy + Math.sin(theta) * r;
        const node = nodeMap.get(id);
        if (node) {
          node.x = x;
          node.y = y;
        }
      });
    });

    return {
      nodes: Array.from(nodeMap.values()),
      links: edges.map((e: any) => ({ ...e })),
    };
  }, [data]);

  // ノードID→Note情報のマップ（title, preview, date など）
  // 全ノート情報を取得（window経由でGraphPageから受け取る）
  const allNotes = (typeof window !== "undefined" && (window as any).__ALL_NOTES__) as Note[] | undefined;
  const noteMap = useMemo(() => {
    const map = new Map<number, Partial<Note>>();
    nodes.forEach(n => {
      map.set(n.id, { id: n.id, title: n.title });
    });
    // graphResultsで補完
    graphResults.forEach(n => {
      map.set(n.id, { ...map.get(n.id), ...n });
    });
    // allNotesでさらに詳細を補完
    if (allNotes) {
      allNotes.forEach(n => {
        if (map.has(n.id)) map.set(n.id, { ...map.get(n.id), ...n });
      });
    }
    return map;
  }, [nodes, graphResults, allNotes]);

  // 検索ハイライト集合
  const searchSet = useMemo(() => new Set(graphResults.map((n) => n.id)), [graphResults]);

  // リサイズ対応
  useEffect(() => {
    const wrap = wrapRef.current!;
    const canvas = canvasRef.current!;
    const ro = new ResizeObserver(() => {
  const w = width ?? (wrap.clientWidth || 800);
  const h = height ?? (wrap.clientHeight || 600);
      canvas.width = w * devicePixelRatio;
      canvas.height = h * devicePixelRatio;
      canvas.style.width = `${w}px`;
      canvas.style.height = `${h}px`;
      draw();
    });
    ro.observe(wrap);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [width, height]);

  // シミュレーション
  useEffect(() => {
    const R = NODE_R + 8; // margin
    const sim = d3
      .forceSimulation(nodes as any)
      .force("link", d3.forceLink(links as any).id((d: any) => d.id).distance(250).strength(0.4))
      .force("charge", d3.forceManyBody().strength(-120))
      .force("center", d3.forceCenter(0, 0))
      .force("collide", d3.forceCollide(R))
      .alpha(1)
      .alphaDecay(0.1); // 早めに安定化

    sim.on("tick", draw);
    simRef.current = sim;

    // 既にフォーカス指定があれば中央寄せ
    if (focusNoteId != null) focusNode(focusNoteId, { centerOnly: true });

    return () => {
      sim.stop();
      simRef.current = null;
    };
    // 依存はIDセットのみに（座標変化で無限再作成を避ける）
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes, links]);

  // ズーム/パン
  useEffect(() => {
    const canvas = canvasRef.current!;
    const zoom = d3
      .zoom<HTMLCanvasElement, unknown>()
      .scaleExtent([0.2, 4])
      .on("zoom", (event: any) => {
        transformRef.current = event.transform;
        draw();
      });
    d3.select(canvas).call(zoom as any);
    return () => {
      d3.select(canvas).on(".zoom", null);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ノードドラッグ（固定）
  useEffect(() => {
    const canvas = canvasRef.current!;
    let dragId: number | null = null;

    function pickNode(px: number, py: number) {
      const [gx, gy] = transformRef.current.invert([px, py]);
      const r = NODE_R;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i] as any;
        const dx = gx - (n.x ?? 0);
        const dy = gy - (n.y ?? 0);
        if (dx * dx + dy * dy <= r * r) return n;
      }
      return null;
    }

    function onDown(ev: PointerEvent) {
      const rect = canvas.getBoundingClientRect();
      const n = pickNode(ev.clientX - rect.left, ev.clientY - rect.top);
      if (!n) return;
      dragId = n.id;
      n.fx = n.x;
      n.fy = n.y;
      simRef.current?.alphaTarget(0.3).restart();
      canvas.setPointerCapture(ev.pointerId);
    }
    function onMove(ev: PointerEvent) {
      if (dragId == null) return;
      const rect = canvas.getBoundingClientRect();
      const [gx, gy] = transformRef.current.invert([ev.clientX - rect.left, ev.clientY - rect.top]);
      const n = nodes.find((m: any) => m.id === dragId) as any;
      if (n) {
        n.fx = gx;
        n.fy = gy;
        simRef.current?.alphaTarget(0.1);
        draw();
      }
    }
    function onUp(ev: PointerEvent) {
      if (dragId != null) {
        simRef.current?.alphaTarget(0);
        canvas.releasePointerCapture(ev.pointerId);
        dragId = null;
      }
    }

    canvas.addEventListener("pointerdown", onDown);
    canvas.addEventListener("pointermove", onMove);
    canvas.addEventListener("pointerup", onUp);
    return () => {
      canvas.removeEventListener("pointerdown", onDown);
      canvas.removeEventListener("pointermove", onMove);
      canvas.removeEventListener("pointerup", onUp);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // クリック／ダブルクリック
  useEffect(() => {
    const canvas = canvasRef.current!;
    let timer: any = null;

    function pick(px: number, py: number) {
      const [gx, gy] = transformRef.current.invert([px, py]);
      const r = NODE_R;
      for (let i = nodes.length - 1; i >= 0; i--) {
        const n = nodes[i] as any;
        const dx = gx - (n.x ?? 0);
        const dy = gy - (n.y ?? 0);
        if (dx * dx + dy * dy <= r * r) return n;
      }
      return null;
    }

    function onClick(ev: MouseEvent) {
  const rect = canvas.getBoundingClientRect();
  const n = pick(ev.clientX - rect.left, ev.clientY - rect.top);
  if (!n) return;
  // クリック直後にノートを開く（ダブルクリック判定不要）
  router.push(`/notes/${n.id}?from=graph`);
    }


  // ダブルクリック時のノード固定解除機能は無効化
  // function onDblClick(ev: MouseEvent) {
  //   if (timer) {
  //     clearTimeout(timer);
  //     timer = null;
  //   }
  //   const rect = canvas.getBoundingClientRect();
  //   const n = pick(ev.clientX - rect.left, ev.clientY - rect.top);
  //   if (!n) return;
  //   n.fx = null;
  //   n.fy = null;
  //   simRef.current?.alpha(0.6).restart();
  // }

    canvas.addEventListener("click", onClick);
    // canvas.addEventListener("dblclick", onDblClick); // 無効化
    return () => {
      canvas.removeEventListener("click", onClick);
      // canvas.removeEventListener("dblclick", onDblClick); // 無効化
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nodes]);

  // Sidebar のスナップ要求を反映
  useEffect(() => {
    if (focusNoteId != null) focusNode(focusNoteId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusNoteId]);

  function focusNode(id: number, opts?: { centerOnly?: boolean }) {
    const n = (nodes as any[]).find((m) => m.id === id);
    if (!n) return;
    const canvas = canvasRef.current!;
    const w = canvas.width / devicePixelRatio;
    const h = canvas.height / devicePixelRatio;
    const k = transformRef.current.k;
    const tx = w / 2 - (n.x ?? 0) * k;
    const ty = h / 2 - (n.y ?? 0) * k;
    const t = d3.zoomIdentity.translate(tx, ty).scale(k);
    d3.select(canvas)
      .transition()
      .duration(450)
      .call((d3.zoom() as any).transform, t)
      .on('end', function() {
        // transition完了時にtransformを取得し、反映して再描画
        // @ts-ignore
        const tr = d3.zoomTransform(canvas);
        transformRef.current = tr;
        draw();
      });

    // サイドバーからのスナップ時は一度全ノードのfx,fyを解除し、対象ノードのみ一時固定→解除
    if (!opts?.centerOnly) {
      (nodes as any[]).forEach(m => { m.fx = null; m.fy = null; });
      (n as any).fx = n.x;
      (n as any).fy = n.y;
      snapNodeIdRef.current = id;
      simRef.current?.alpha(0.5).restart();
      setTimeout(() => {
        (n as any).fx = null;
        (n as any).fy = null;
        snapNodeIdRef.current = null;
        draw(); // 解除後にも再描画
      }, 800);
    }
    draw(); // スナップ直後にも再描画
  }

  function draw() {
    const canvas = canvasRef.current!;
    if (!canvas) return;
    const ctx = canvas.getContext("2d")!;
    const w = canvas.width;
    const h = canvas.height;

    ctx.save();
    ctx.clearRect(0, 0, w, h);
    ctx.translate(transformRef.current.x * devicePixelRatio, transformRef.current.y * devicePixelRatio);
    ctx.scale(transformRef.current.k * devicePixelRatio, transformRef.current.k * devicePixelRatio);

    // edges
    ctx.globalAlpha = 0.6;
    ctx.lineWidth = 1.2;
    ctx.strokeStyle = "#cbd5e1";
    (links as any[]).forEach((l) => {
      const s = typeof l.source === "object" ? (l.source as any) : nodes.find((n: any) => n.id === l.source);
      const t = typeof l.target === "object" ? (l.target as any) : nodes.find((n: any) => n.id === l.target);
      if (!s || !t) return;
      ctx.beginPath();
      ctx.moveTo(s.x ?? 0, s.y ?? 0);
      ctx.lineTo(t.x ?? 0, t.y ?? 0);
      ctx.stroke();
    });

    // nodes
    (nodes as any[]).forEach((n) => {
      const isSearch = searchSet.has(n.id);
      const isSnap = snapNodeIdRef.current === n.id;
      const note = noteMap.get(n.id) as Note | undefined;
      // NoteCard風デザイン
      const w = NODE_W, h = NODE_H, r = 10, pad = 8;
      const x = n.x ?? 0, y = n.y ?? 0;
      // 背景
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x - w/2 + r, y - h/2);
      ctx.lineTo(x + w/2 - r, y - h/2);
      ctx.quadraticCurveTo(x + w/2, y - h/2, x + w/2, y - h/2 + r);
      ctx.lineTo(x + w/2, y + h/2 - r);
      ctx.quadraticCurveTo(x + w/2, y + h/2, x + w/2 - r, y + h/2);
      ctx.lineTo(x - w/2 + r, y + h/2);
      ctx.quadraticCurveTo(x - w/2, y + h/2, x - w/2, y + h/2 - r);
      ctx.lineTo(x - w/2, y - h/2 + r);
      ctx.quadraticCurveTo(x - w/2, y - h/2, x - w/2 + r, y - h/2);
      ctx.closePath();
      ctx.fillStyle = isSnap ? "#f3e8ff" : isSearch ? "#d1fae5" : "#fff";
      ctx.strokeStyle = isSnap ? "#a855f7" : isSearch ? "#10b981" : "#e5e5e5";
      ctx.lineWidth = 2;
      ctx.shadowColor = "#0002";
      ctx.shadowBlur = 2;
      ctx.fill();
      ctx.shadowBlur = 0;
      ctx.stroke();
      // テキストを省略せず、はみ出た分は…で省略
      function drawEllipsisText(text: string, font: string, color: string, tx: number, ty: number, maxWidth: number) {
        ctx.save();
        ctx.font = font;
        ctx.fillStyle = color;
        ctx.textBaseline = "top";
        let display = text;
        if (ctx.measureText(text).width > maxWidth) {
          while (display.length > 0 && ctx.measureText(display + "…").width > maxWidth) {
            display = display.slice(0, -1);
          }
          display = display + "…";
        }
        ctx.fillText(display, tx, ty);
        ctx.restore();
      }
      // タイトル
      drawEllipsisText(note?.title ?? String(n.id), "bold 14px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif", "#111827", x - w/2 + pad, y - h/2 + pad, w - pad*2);
      // 日付
      const dateISO = datePref === "updated" ? note?.accessed_at : note?.created_date;
      const label = datePref === "updated" ? "更新" : "作成";
      drawEllipsisText(`${label}: ${formatJP(dateISO)}`, "12px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif", "#6b7280", x - w/2 + pad, y - h/2 + 28, w - pad*2);
      // プレビュー
      if (note?.preview) {
        drawEllipsisText(note.preview, "12px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif", "#374151", x - w/2 + pad, y - h/2 + 44, w - pad*2);
      }
      ctx.restore();
    });

    ctx.restore();
  }

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%" }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
