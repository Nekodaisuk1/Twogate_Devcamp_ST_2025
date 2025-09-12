"use client";
import React, { useEffect, useMemo, useRef } from "react";
import * as d3 from "d3";
import type { GraphPayload } from "@/lib/types";
import { useUiStore } from "@/lib/stores/useUiStore";
import { useRouter } from "next/navigation";

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

  const { graphResults, focusNoteId, setFocus } = useUiStore();
  const router = useRouter();

  // d3 が書き換えるためコピーを作る
  const { nodes, links } = useMemo(() => {
    const edges =
      (data as any).edges ??
      (data as any).links?.map((l: any) => ({ source: l.source, target: l.target, score: l.value })) ??
      [];
    return {
      nodes: data.nodes.map((n) => ({ ...n })),
      links: edges.map((e: any) => ({ ...e })),
    };
  }, [data]);

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
    const sim = d3
      .forceSimulation(nodes as any)
      .force("link", d3.forceLink(links as any).id((d: any) => d.id).distance(90).strength(0.2))
      .force("charge", d3.forceManyBody().strength(-220))
      .force("center", d3.forceCenter(0, 0))
      .alpha(1);

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
  }, [JSON.stringify(nodes.map((n) => n.id)), JSON.stringify(links.map((l: any) => [l.source, l.target]))]);

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
  }, []);

  // ノードドラッグ（固定）
  useEffect(() => {
    const canvas = canvasRef.current!;
    let dragId: number | null = null;

    function pickNode(px: number, py: number) {
      const [gx, gy] = transformRef.current.invert([px, py]);
      const r = 14;
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
      const r = 14;
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
      if (timer) clearTimeout(timer);
      timer = setTimeout(() => {
        // 編集画面へ遷移（from=graph付き）
        router.push(`/notes/${n.id}?from=graph`);
      }, 180);
    }

    function onDblClick(ev: MouseEvent) {
      if (timer) {
        clearTimeout(timer);
        timer = null;
      }
      const rect = canvas.getBoundingClientRect();
      const n = pick(ev.clientX - rect.left, ev.clientY - rect.top);
      if (!n) return;
      n.fx = null;
      n.fy = null;
      simRef.current?.alpha(0.6).restart();
    }

    canvas.addEventListener("click", onClick);
    canvas.addEventListener("dblclick", onDblClick);
    return () => {
      canvas.removeEventListener("click", onClick);
      canvas.removeEventListener("dblclick", onDblClick);
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

    const sel = d3.select(canvas);
    (sel as any).transition().duration(450).call((d3.zoom() as any).transform, t);

    if (!opts?.centerOnly) {
      (n as any).fx = n.x;
      (n as any).fy = n.y;
      simRef.current?.alpha(0.5).restart();
      setTimeout(() => {
        (n as any).fx = null;
        (n as any).fy = null;
      }, 800);
    }
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
      const isFocus = focusNoteId === n.id;
      const isSearch = searchSet.has(n.id);

      // halo
      if (isFocus || isSearch) {
        ctx.beginPath();
        ctx.arc(n.x ?? 0, n.y ?? 0, 15, 0, Math.PI * 2);
        ctx.fillStyle = isFocus ? "rgba(37,99,235,0.22)" : "rgba(16,185,129,0.20)";
        ctx.fill();
      }

      // circle
      ctx.beginPath();
      ctx.arc(n.x ?? 0, n.y ?? 0, 8, 0, Math.PI * 2);
      ctx.fillStyle = isFocus ? "#2563eb" : isSearch ? "#10b981" : "#111827";
      ctx.fill();

      // label
      ctx.font = "12px -apple-system, BlinkMacSystemFont, Segoe UI, Roboto, Helvetica, Arial, sans-serif";
      ctx.textBaseline = "middle";
      ctx.fillStyle = "#111827";
      ctx.fillText(n.title ?? String(n.id), (n.x ?? 0) + 12, (n.y ?? 0));
    });

    ctx.restore();
  }

  return (
    <div ref={wrapRef} style={{ width: "100%", height: "100%" }}>
      <canvas ref={canvasRef} />
    </div>
  );
}
