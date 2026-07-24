import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import FTTHFlow from "@/components/ftth/FTTHFlow";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Save,
  Printer,
  Download,
  ArrowLeft,
  Link2,
  MousePointer2,
  Upload,
  Image as ImageIcon,
  AlertTriangle,
  Wand2,
} from "lucide-react";

export const Route = createFileRoute("/_authenticated/ftth")({
  component: FtthPage,
});

// ---------------- Types ----------------
type NodeType = "olt" | "splitter" | "cto" | "emenda" | "cliente";

interface FNode {
  id: string;
  type: NodeType;
  label: string;
  x: number;
  y: number;
  // splitter ratio: 2,4,8,16,32
  ratio?: number;
  // optional extra loss (e.g., emenda)
  extra_loss_db?: number;
  // Auto-recognition metadata (only present for nodes created via SVG import)
  recog_confidence?: number; // 0..1
  recog_source?: "text" | "shape" | "fallback";
  recog_issues?: string[];
}

interface FEdge {
  id: string;
  from: string;
  to: string;
  length_m: number; // fiber length in meters
  connectors?: number; // number of connectors on this segment
}

interface Diagram {
  nodes: FNode[];
  edges: FEdge[];
  background?: string | null; // data URL of an imported SVG used as tracing layer
}

interface Projeto {
  id: string;
  nome: string;
  descricao: string | null;
  olt_tx_dbm: number;
  data: Diagram;
  updated_at: string;
}

// ---------------- Constants ----------------
const SPLITTER_LOSS: Record<number, number> = {
  2: 3.5,
  4: 7.2,
  8: 10.5,
  16: 13.5,
  32: 17.0,
};
const FIBER_LOSS_PER_KM = 0.35; // dB/km @ 1310nm
const CONNECTOR_LOSS = 0.3; // per connector
const SPLICE_LOSS = 0.1; // emenda default
const CANVAS_W = 1200;
const CANVAS_H = 700;
const CANVAS_PAD = 36;

function uid() {
  return Math.random().toString(36).slice(2, 10);
}

function clampNodePosition(node: FNode): FNode {
  const size = NODE_SIZE[node.type];
  const minX = CANVAS_PAD + size.w / 2;
  const maxX = CANVAS_W - CANVAS_PAD - size.w / 2;
  const minY = CANVAS_PAD + size.h / 2;
  const maxY = CANVAS_H - CANVAS_PAD - size.h / 2;

  return {
    ...node,
    x: Math.min(maxX, Math.max(minX, Number.isFinite(node.x) ? node.x : CANVAS_W / 2)),
    y: Math.min(maxY, Math.max(minY, Number.isFinite(node.y) ? node.y : CANVAS_H / 2)),
  };
}

function normalizeDiagram(diagram: Diagram): Diagram {
  const normalized = {
    ...diagram,
    nodes: (diagram.nodes ?? []).map(clampNodePosition),
    edges: (diagram.edges ?? []).filter((edge) => edge.from !== edge.to),
  };

  if (normalized.nodes.length > 1 && normalized.edges.length === 0) {
    return organizeDiagram(normalized);
  }

  return normalized;
}

function nextPositionFor(type: NodeType, diagram: Diagram) {
  const byType = diagram.nodes.filter((node) => node.type === type).length;
  const columns: Record<NodeType, number> = {
    olt: 120,
    splitter: 360,
    emenda: 540,
    cto: 720,
    cliente: 980,
  };

  return {
    x: columns[type],
    y: 180 + (byType % 5) * 95,
  };
}

function organizeDiagram(diagram: Diagram): Diagram {
  const order: NodeType[] = ["olt", "splitter", "emenda", "cto", "cliente"];
  const grouped = new Map<NodeType, FNode[]>();

  for (const type of order) {
    grouped.set(
      type,
      diagram.nodes.filter((node) => node.type === type),
    );
  }

  const nodes = order.flatMap((type, typeIndex) => {
    const group = grouped.get(type) ?? [];
    const gap = Math.min(125, Math.max(72, (CANVAS_H - 160) / Math.max(1, group.length)));
    const startY = CANVAS_H / 2 - ((group.length - 1) * gap) / 2;
    const x = 120 + typeIndex * 250;

    return group.map((node, index) =>
      clampNodePosition({
        ...node,
        x,
        y: startY + index * gap,
      }),
    );
  });

  return { ...diagram, nodes };
}

// ---------------- Power calc ----------------
function calcPowers(diagram: Diagram, oltTx: number) {
  const rx: Record<string, number> = {};
  const tx: Record<string, number> = {};
  const childMap: Record<string, FEdge[]> = {};
  for (const e of diagram.edges) {
    (childMap[e.from] ||= []).push(e);
  }
  const olt = diagram.nodes.find((n) => n.type === "olt");
  if (!olt) return { rx, tx };
  tx[olt.id] = oltTx;
  rx[olt.id] = oltTx;
  const visit = (nodeId: string) => {
    const out = tx[nodeId];
    if (out === undefined) return;
    for (const e of childMap[nodeId] || []) {
      const fiber = (e.length_m / 1000) * FIBER_LOSS_PER_KM;
      const conn = (e.connectors ?? 2) * CONNECTOR_LOSS;
      const childRx = out - fiber - conn;
      rx[e.to] = childRx;
      const child = diagram.nodes.find((n) => n.id === e.to);
      if (!child) continue;
      let loss = 0;
      if (child.type === "splitter" && child.ratio) loss = SPLITTER_LOSS[child.ratio] ?? 0;
      if (child.type === "emenda") loss = child.extra_loss_db ?? SPLICE_LOSS;
      tx[child.id] = childRx - loss;
      visit(child.id);
    }
  };
  visit(olt.id);
  return { rx, tx };
}

function powerColor(dbm: number | undefined) {
  if (dbm === undefined) return "hsl(var(--muted-foreground))";
  if (dbm > -22) return "hsl(142 70% 40%)";
  if (dbm > -27) return "hsl(38 90% 50%)";
  return "hsl(0 75% 55%)";
}

// Confidence helpers for auto-recognized nodes
function confColor(c: number | undefined): string {
  if (c === undefined) return "transparent";
  if (c >= 0.85) return "hsl(142 70% 40%)";
  if (c >= 0.6) return "hsl(38 90% 50%)";
  return "hsl(0 75% 55%)";
}
function confLabel(c: number | undefined): string {
  if (c === undefined) return "—";
  return `${Math.round(c * 100)}%`;
}

// ---------------- Main component ----------------
function FtthPage() {
  const [projetos, setProjetos] = useState<Projeto[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Projeto | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [novoNome, setNovoNome] = useState("");

  async function load() {
    setLoading(true);
    const { data, error } = await supabase
      .from("projetos_ftth")
      .select("*")
      .order("updated_at", { ascending: false });
    if (error) toast.error(error.message);
    else setProjetos((data as unknown as Projeto[]) ?? []);
    setLoading(false);
  }
  useEffect(() => {
    load();
  }, []);

  async function criar() {
    if (!novoNome.trim()) return;
    const { data, error } = await supabase
      .from("projetos_ftth")
      .insert({
        nome: novoNome,
        data: {
          nodes: [{ id: uid(), type: "olt", label: "OLT", x: 120, y: 350 }],
          edges: [],
        } as unknown as never,
      })
      .select("*")
      .single();
    if (error) return toast.error(error.message);
    setNovoNome("");
    setCreateOpen(false);
    await load();
    setSelected(data as unknown as Projeto);
  }

  async function excluir(p: Projeto) {
    if (!confirm(`Excluir o projeto "${p.nome}"?`)) return;
    const { error } = await supabase.from("projetos_ftth").delete().eq("id", p.id);
    if (error) return toast.error(error.message);
    toast.success("Excluído");
    load();
  }

  if (selected) {
    return (
      <Editor
        projeto={selected}
        onBack={() => {
          setSelected(null);
          load();
        }}
      />
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold">Projetos FTTH</h1>
          <p className="text-sm text-muted-foreground">
            Desenhe a rede óptica: OLT, splitters, CTOs, caixas de emenda e clientes. Cálculo de
            potência automático.
          </p>
        </div>
        <Dialog open={createOpen} onOpenChange={setCreateOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Novo projeto
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Novo projeto FTTH</DialogTitle>
            </DialogHeader>
            <div className="space-y-2">
              <Label>Nome</Label>
              <Input
                value={novoNome}
                onChange={(e) => setNovoNome(e.target.value)}
                placeholder="Ex: Bairro Centro"
              />
            </div>
            <DialogFooter>
              <Button onClick={criar}>Criar</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>

      {loading ? (
        <p className="text-muted-foreground">Carregando...</p>
      ) : projetos.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center text-muted-foreground">
            Nenhum projeto ainda. Crie o primeiro acima.
          </CardContent>
        </Card>
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projetos.map((p) => (
            <Card
              key={p.id}
              className="cursor-pointer hover:border-primary transition-colors"
              onClick={() => setSelected(p)}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-base">{p.nome}</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <div className="text-xs text-muted-foreground">
                  {p.data?.nodes?.length ?? 0} nós · {p.data?.edges?.length ?? 0} conexões
                </div>
                <div className="flex justify-between items-center pt-2">
                  <span className="text-xs text-muted-foreground">
                    {new Date(p.updated_at).toLocaleDateString("pt-BR")}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={(e) => {
                      e.stopPropagation();
                      excluir(p);
                    }}
                  >
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------------- Editor ----------------
const NODE_SIZE: Record<NodeType, { w: number; h: number }> = {
  olt: { w: 90, h: 60 },
  splitter: { w: 80, h: 50 },
  cto: { w: 80, h: 60 },
  emenda: { w: 70, h: 40 },
  cliente: { w: 70, h: 50 },
};

const NODE_COLOR: Record<NodeType, string> = {
  olt: "hsl(217 91% 60%)",
  splitter: "hsl(262 70% 60%)",
  cto: "hsl(28 90% 55%)",
  emenda: "hsl(190 70% 50%)",
  cliente: "hsl(142 60% 45%)",
};

const NODE_LABEL: Record<NodeType, string> = {
  olt: "OLT",
  splitter: "Splitter",
  cto: "CTO",
  emenda: "Caixa de Emenda",
  cliente: "Cliente",
};

function Editor({ projeto, onBack }: { projeto: Projeto; onBack: () => void }) {
  const [nome, setNome] = useState(projeto.nome);
  const [desc, setDesc] = useState(projeto.descricao ?? "");
  const [oltTx, setOltTx] = useState<number>(Number(projeto.olt_tx_dbm) || 3);
  const [diagram, setDiagram] = useState<Diagram>(() =>
    normalizeDiagram(projeto.data ?? { nodes: [], edges: [] }),
  );
  const [selNode, setSelNode] = useState<string | null>(null);
  const [selEdge, setSelEdge] = useState<string | null>(null);
  const [linkFrom, setLinkFrom] = useState<string | null>(null); // when set, click target to connect
  const [saving, setSaving] = useState(false);
  const svgRef = useRef<SVGSVGElement>(null);
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const powers = useMemo(() => calcPowers(diagram, oltTx), [diagram, oltTx]);

  function addNode(type: NodeType) {
    const position = nextPositionFor(type, diagram);
    const n: FNode = {
      id: uid(),
      type,
      label: NODE_LABEL[type],
      x: position.x,
      y: position.y,
      ...(type === "splitter" ? { ratio: 8 } : {}),
      ...(type === "emenda" ? { extra_loss_db: SPLICE_LOSS } : {}),
    };
    setDiagram((d) => ({ ...d, nodes: [...d.nodes, n] }));
    setSelNode(n.id);
  }

  function updateNode(id: string, patch: Partial<FNode>) {
    setDiagram((d) => ({
      ...d,
      nodes: d.nodes.map((n) => (n.id === id ? { ...n, ...patch } : n)),
    }));
  }

  function deleteNode(id: string) {
    setDiagram((d) => ({
      nodes: d.nodes.filter((n) => n.id !== id),
      edges: d.edges.filter((e) => e.from !== id && e.to !== id),
    }));
    setSelNode(null);
  }

  function deleteEdge(id: string) {
    setDiagram((d) => ({ ...d, edges: d.edges.filter((e) => e.id !== id) }));
    setSelEdge(null);
  }

  function updateEdge(id: string, patch: Partial<FEdge>) {
    setDiagram((d) => ({
      ...d,
      edges: d.edges.map((e) => (e.id === id ? { ...e, ...patch } : e)),
    }));
  }

  function startLink(id: string) {
    setLinkFrom(id);
    setSelEdge(null);
    toast.info("Clique no nó de destino para conectar");
  }

  function handleNodeClick(id: string) {
    if (linkFrom && linkFrom !== id) {
      // prevent cycles: target must not already have a parent
      const hasParent = diagram.edges.some((e) => e.to === id);
      if (hasParent) {
        toast.error("Este nó já tem um pai. Remova a conexão anterior.");
        setLinkFrom(null);
        return;
      }
      const newEdge: FEdge = { id: uid(), from: linkFrom, to: id, length_m: 100, connectors: 2 };
      setDiagram((d) => ({ ...d, edges: [...d.edges, newEdge] }));
      setLinkFrom(null);
      toast.success("Conectado");
      return;
    }
    setSelNode(id);
    setSelEdge(null);
  }

  function onPointerDownNode(e: React.PointerEvent, n: FNode) {
    if (linkFrom) return;
    (e.target as Element).setPointerCapture?.(e.pointerId);
    const pt = getSvgPoint(e);
    dragRef.current = { id: n.id, dx: pt.x - n.x, dy: pt.y - n.y };
  }
  function onPointerMove(e: React.PointerEvent) {
    if (!dragRef.current) return;
    const pt = getSvgPoint(e);
    const { id, dx, dy } = dragRef.current;
    const node = diagram.nodes.find((n) => n.id === id);
    if (!node) return;
    updateNode(id, clampNodePosition({ ...node, x: pt.x - dx, y: pt.y - dy }));
  }
  function onPointerUp() {
    dragRef.current = null;
  }
  function getSvgPoint(e: React.PointerEvent | React.MouseEvent) {
    const svg = svgRef.current;
    if (!svg) return { x: 0, y: 0 };
    const pt = svg.createSVGPoint();
    pt.x = e.clientX;
    pt.y = e.clientY;
    const ctm = svg.getScreenCTM();
    if (!ctm) return { x: 0, y: 0 };
    const m = pt.matrixTransform(ctm.inverse());
    return { x: m.x, y: m.y };
  }

  async function salvar() {
    setSaving(true);
    const { error } = await supabase
      .from("projetos_ftth")
      .update({ nome, descricao: desc, olt_tx_dbm: oltTx, data: diagram as unknown as never })
      .eq("id", projeto.id);
    setSaving(false);
    if (error) return toast.error(error.message);
    toast.success("Projeto salvo");
  }

  function exportSvg() {
    const svg = svgRef.current;
    if (!svg) return;
    const clone = svg.cloneNode(true) as SVGSVGElement;
    clone.setAttribute("xmlns", "http://www.w3.org/2000/svg");
    clone.setAttribute("data-ftth-version", "1");
    clone.setAttribute("data-ftth-olt-tx", String(oltTx));
    clone.setAttribute("data-ftth-name", nome);
    // Embed the diagram JSON so re-import is lossless
    const meta = document.createElementNS("http://www.w3.org/2000/svg", "metadata");
    meta.setAttribute("id", "ftth-data");
    meta.textContent = JSON.stringify({ oltTx, nome, desc, diagram });
    clone.insertBefore(meta, clone.firstChild);
    const xml = new XMLSerializer().serializeToString(clone);
    const blob = new Blob([xml], { type: "image/svg+xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${nome || "projeto"}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function onImportClick() {
    fileRef.current?.click();
  }

  async function onImportFile(ev: React.ChangeEvent<HTMLInputElement>) {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (!file) return;
    try {
      const text = await file.text();
      const parser = new DOMParser();
      const doc = parser.parseFromString(text, "image/svg+xml");
      const root = doc.documentElement;
      if (!root || root.nodeName.toLowerCase() !== "svg") {
        toast.error("Arquivo SVG inválido");
        return;
      }
      // 1) Try to restore a diagram previously exported by this editor
      const meta = doc.getElementById("ftth-data");
      const rawJson = meta?.textContent?.trim();
      if (rawJson) {
        try {
          const parsed = JSON.parse(rawJson) as {
            oltTx?: number;
            nome?: string;
            desc?: string;
            diagram?: Diagram;
          };
          if (parsed.diagram?.nodes && parsed.diagram?.edges) {
            const replace = confirm(
              "SVG do editor detectado. Substituir o diagrama atual pelo importado?",
            );
            if (!replace) return;
            setDiagram({
              nodes: parsed.diagram.nodes.map(clampNodePosition),
              edges: parsed.diagram.edges,
              background: diagram.background ?? null,
            });
            if (parsed.oltTx !== undefined) setOltTx(Number(parsed.oltTx));
            if (parsed.nome) setNome(parsed.nome);
            if (parsed.desc !== undefined) setDesc(parsed.desc);
            setSelNode(null);
            setSelEdge(null);
            toast.success("Diagrama importado");
            return;
          }
        } catch {
          // fall through to background mode
        }
      }
      // 2) Generic SVG → use as a background tracing layer
      // Ensure viewBox so it scales with our canvas
      if (!root.getAttribute("viewBox")) {
        const w = root.getAttribute("width") ?? "1200";
        const h = root.getAttribute("height") ?? "700";
        root.setAttribute("viewBox", `0 0 ${parseFloat(w) || 1200} ${parseFloat(h) || 700}`);
      }
      root.setAttribute("preserveAspectRatio", "xMidYMid meet");
      const cleaned = new XMLSerializer().serializeToString(root);
      const dataUrl = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(cleaned)));
      const tryRecognize = confirm(
        "SVG genérico detectado.\n\nOK = reconhecer automaticamente splitters, CTOs, emendas e clientes (por rótulos/ids).\nCancelar = usar apenas como camada de fundo para traçar por cima.",
      );
      if (tryRecognize) {
        applyRecognized(cleaned, dataUrl);
      } else {
        setDiagram((d) => ({ ...d, background: dataUrl }));
        toast.success("Camada de fundo carregada");
      }
    } catch (err) {
      toast.error("Falha ao ler o SVG");
      console.error(err);
    }
  }

  function removeBackground() {
    setDiagram((d) => ({ ...d, background: null }));
  }

  function applyRecognized(svgText: string, dataUrl: string) {
    const recognized = recognizeSvg(svgText);
    if (!recognized || recognized.nodes.length === 0) {
      toast.message("Nenhum elemento reconhecido — usando como camada de fundo");
      setDiagram((d) => ({ ...d, background: dataUrl }));
      return;
    }
    const hasOlt = recognized.nodes.some((n) => n.type === "olt");
    let nodes: FNode[] = hasOlt
      ? recognized.nodes
      : [
          {
            id: uid(),
            type: "olt",
            label: "OLT",
            x: 80,
            y: 350,
            recog_confidence: 0.3,
            recog_source: "fallback",
            recog_issues: ["OLT não encontrada no SVG — adicionada automaticamente"],
          },
          ...recognized.nodes,
        ];
    // Rebuild edges referencing the (possibly prepended) OLT
    const edges = rebuildEdges(nodes);
    // Flag nodes that ended up without a parent edge (orphans)
    const hasParent = new Set(edges.map((e) => e.to));
    nodes = nodes.map((n) => {
      if (n.type === "olt") return n;
      if (hasParent.has(n.id)) return n;
      const issues = [...(n.recog_issues ?? []), "Sem pai conectado — conecte manualmente"];
      const conf = Math.min(n.recog_confidence ?? 0.6, 0.45);
      return { ...n, recog_issues: issues, recog_confidence: conf };
    });
    setDiagram(normalizeDiagram({ nodes, edges, background: dataUrl }));
    setSelNode(null);
    setSelEdge(null);
    const low = nodes.filter(
      (n) => (n.recog_confidence ?? 1) < 0.7 || (n.recog_issues?.length ?? 0) > 0,
    ).length;
    if (low > 0) {
      toast.warning(
        `Reconhecidos ${nodes.length} elementos · ${edges.length} conexões · ${low} precisam de revisão`,
      );
    } else {
      toast.success(`Reconhecidos ${nodes.length} elementos · ${edges.length} conexões`);
    }
  }

  function clearRecogMarks() {
    setDiagram((d) => ({
      ...d,
      nodes: d.nodes.map((n) => {
        // strip recog_* fields
        const { recog_confidence: _c, recog_source: _s, recog_issues: _i, ...rest } = n;
        return rest as FNode;
      }),
    }));
    toast.success("Marcações de revisão removidas");
  }

  function printPdf() {
    const svg = svgRef.current;
    if (!svg) return;
    const xml = new XMLSerializer().serializeToString(svg);
    const w = window.open("", "_blank", "width=1200,height=800");
    if (!w) return;
    w.document.write(`<!doctype html><html><head><title>${nome}</title>
      <style>
        body{font-family:system-ui,sans-serif;margin:24px;color:#111;}
        h1{margin:0 0 4px;font-size:20px}
        .meta{color:#555;font-size:12px;margin-bottom:16px}
        svg{width:100%;height:auto;border:1px solid #ddd;border-radius:8px;background:#fff}
        table{border-collapse:collapse;margin-top:20px;width:100%;font-size:12px}
        th,td{border:1px solid #ddd;padding:6px 8px;text-align:left}
        th{background:#f3f4f6}
        @media print{button{display:none}}
      </style>
    </head><body>
      <h1>${escapeHtml(nome)}</h1>
      <div class="meta">${escapeHtml(desc)}</div>
      <div class="meta">OLT TX: ${oltTx} dBm · ${diagram.nodes.length} nós · ${diagram.edges.length} conexões</div>
      ${xml}
      ${renderPowerTable(diagram, powers)}
      <button onclick="window.print()" style="margin-top:16px;padding:8px 16px">Imprimir / Salvar PDF</button>
    </body></html>`);
    w.document.close();
    setTimeout(() => w.print(), 400);
  }

  const selectedNode = diagram.nodes.find((n) => n.id === selNode) ?? null;
  const selectedEdge = diagram.edges.find((e) => e.id === selEdge) ?? null;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <Button variant="ghost" size="sm" onClick={onBack}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Voltar
        </Button>
        <Input
          value={nome}
          onChange={(e) => setNome(e.target.value)}
          className="max-w-xs font-semibold"
        />
        <div className="ml-auto flex gap-2 flex-wrap">
          <input
            ref={fileRef}
            type="file"
            accept=".svg,image/svg+xml"
            className="hidden"
            onChange={onImportFile}
          />
          <Button variant="outline" size="sm" onClick={onImportClick}>
            <Upload className="h-4 w-4 mr-2" /> Importar SVG
          </Button>
          <Button variant="outline" size="sm" onClick={exportSvg}>
            <Download className="h-4 w-4 mr-2" /> SVG
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setDiagram((d) => organizeDiagram(d));
              setSelNode(null);
              setSelEdge(null);
            }}
          >
            <Wand2 className="h-4 w-4 mr-2" /> Organizar
          </Button>
          <Button variant="outline" size="sm" onClick={printPdf}>
            <Printer className="h-4 w-4 mr-2" /> Imprimir/PDF
          </Button>
          <Button size="sm" onClick={salvar} disabled={saving}>
            <Save className="h-4 w-4 mr-2" /> {saving ? "Salvando..." : "Salvar"}
          </Button>
        </div>
      </div>

      <div className="grid xl:grid-cols-[240px_minmax(680px,1fr)_300px] gap-4">
        {/* Palette */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">Adicionar elemento</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(["splitter", "cto", "emenda", "cliente"] as NodeType[]).map((t) => (
              <Button
                key={t}
                variant="outline"
                className="w-full justify-start"
                size="sm"
                onClick={() => addNode(t)}
              >
                <span
                  className="inline-block w-3 h-3 rounded mr-2"
                  style={{ background: NODE_COLOR[t] }}
                />
                {NODE_LABEL[t]}
              </Button>
            ))}
            <div className="pt-2 border-t mt-3 space-y-2">
              <Label className="text-xs">OLT TX (dBm)</Label>
              <Input
                type="number"
                step="0.1"
                value={oltTx}
                onChange={(e) => setOltTx(Number(e.target.value))}
              />
            </div>
            <div className="pt-2 border-t mt-3">
              <Label className="text-xs">Descrição</Label>
              <Textarea
                value={desc}
                onChange={(e) => setDesc(e.target.value)}
                rows={3}
                className="text-xs"
              />
            </div>
            {diagram.background && (
              <div className="pt-2 border-t mt-3 space-y-2">
                <div className="flex items-center gap-2 text-xs">
                  <ImageIcon className="h-3 w-3" />
                  <span className="text-muted-foreground">Camada de fundo ativa</span>
                </div>
                <Button variant="outline" size="sm" className="w-full" onClick={removeBackground}>
                  <Trash2 className="h-3 w-3 mr-2" /> Remover fundo
                </Button>
              </div>
            )}
            {(() => {
              const flagged = diagram.nodes.filter(
                (n) =>
                  n.recog_confidence !== undefined &&
                  ((n.recog_confidence ?? 1) < 0.7 || (n.recog_issues?.length ?? 0) > 0),
              );
              const anyRecog = diagram.nodes.some((n) => n.recog_confidence !== undefined);
              if (!anyRecog) return null;
              return (
                <div className="pt-2 border-t mt-3 space-y-2">
                  <div className="flex items-center gap-2 text-xs">
                    <AlertTriangle className="h-3 w-3" style={{ color: "hsl(38 90% 50%)" }} />
                    <span className="font-medium">
                      Revisão: {flagged.length} de{" "}
                      {diagram.nodes.filter((n) => n.recog_confidence !== undefined).length}
                    </span>
                  </div>
                  {flagged.length > 0 && (
                    <div className="max-h-40 overflow-auto space-y-1">
                      {flagged.map((n) => (
                        <button
                          key={n.id}
                          onClick={() => {
                            setSelNode(n.id);
                            setSelEdge(null);
                          }}
                          className="w-full text-left text-xs rounded border p-1.5 hover:bg-muted/50 transition-colors"
                          style={{
                            borderLeftWidth: 3,
                            borderLeftColor: confColor(n.recog_confidence),
                          }}
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="truncate font-medium">{n.label}</span>
                            <span
                              className="text-[10px] px-1.5 rounded text-white shrink-0"
                              style={{ background: confColor(n.recog_confidence) }}
                            >
                              {confLabel(n.recog_confidence)}
                            </span>
                          </div>
                          {n.recog_issues?.[0] && (
                            <div className="text-[10px] text-muted-foreground truncate">
                              {n.recog_issues[0]}
                            </div>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                  <Button variant="outline" size="sm" className="w-full" onClick={clearRecogMarks}>
                    Limpar marcações
                  </Button>
                </div>
              );
            })()}
            <div className="text-xs text-muted-foreground pt-2 border-t mt-3 space-y-1">
              <div className="font-medium text-foreground">Legenda de sinal</div>
              <div>
                <span style={{ color: "hsl(142 70% 40%)" }}>●</span> &gt; -22 dBm (ótimo)
              </div>
              <div>
                <span style={{ color: "hsl(38 90% 50%)" }}>●</span> -22 a -27 dBm
              </div>
              <div>
                <span style={{ color: "hsl(0 75% 55%)" }}>●</span> &lt; -27 dBm (crítico)
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Canvas */}
        <Card className="overflow-hidden">
          <CardContent className="p-0">
            <div className="relative bg-slate-950">
              {linkFrom && (
                <div className="absolute top-2 left-2 z-10 bg-primary text-primary-foreground text-xs px-3 py-1 rounded-full shadow">
                  Clique no destino para conectar &nbsp;
                  <button onClick={() => setLinkFrom(null)} className="underline">
                    cancelar
                  </button>
                </div>
              )}
              <FTTHFlow
                diagram={diagram}
                setDiagram={setDiagram}
                powers={powers}
                onSelectNode={setSelNode}
                onSelectEdge={setSelEdge}
              />
            </div>
          </CardContent>
        </Card>

        {/* Properties */}
        <Card>
          <CardHeader className="pb-2">
            <CardTitle className="text-sm">
              {selectedNode ? "Nó selecionado" : selectedEdge ? "Conexão" : "Propriedades"}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {!selectedNode && !selectedEdge && (
              <p className="text-xs text-muted-foreground">
                Selecione um nó ou conexão para editar. Arraste os nós para reposicionar.
              </p>
            )}

            {selectedNode && (
              <>
                <div>
                  <Label className="text-xs">Rótulo</Label>
                  <Input
                    value={selectedNode.label}
                    onChange={(e) => updateNode(selectedNode.id, { label: e.target.value })}
                  />
                </div>
                {selectedNode.type === "splitter" && (
                  <div>
                    <Label className="text-xs">Razão</Label>
                    <Select
                      value={String(selectedNode.ratio ?? 8)}
                      onValueChange={(v) => updateNode(selectedNode.id, { ratio: Number(v) })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {[2, 4, 8, 16, 32].map((r) => (
                          <SelectItem key={r} value={String(r)}>
                            1x{r} (-{SPLITTER_LOSS[r]} dB)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {selectedNode.type === "emenda" && (
                  <div>
                    <Label className="text-xs">Perda (dB)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      value={selectedNode.extra_loss_db ?? SPLICE_LOSS}
                      onChange={(e) =>
                        updateNode(selectedNode.id, { extra_loss_db: Number(e.target.value) })
                      }
                    />
                  </div>
                )}
                <div className="text-xs space-y-1 bg-muted/40 rounded p-2">
                  <div>
                    Sinal recebido:{" "}
                    <span
                      style={{ color: powerColor(powers.rx[selectedNode.id]) }}
                      className="font-semibold"
                    >
                      {powers.rx[selectedNode.id]?.toFixed(2) ?? "—"} dBm
                    </span>
                  </div>
                  <div>
                    Saída:{" "}
                    <span className="font-mono">
                      {powers.tx[selectedNode.id]?.toFixed(2) ?? "—"} dBm
                    </span>
                  </div>
                </div>
                {selectedNode.recog_confidence !== undefined && (
                  <div
                    className="text-xs space-y-1 rounded p-2 border"
                    style={{ borderColor: confColor(selectedNode.recog_confidence) }}
                  >
                    <div className="flex items-center justify-between">
                      <span className="font-medium">Confiança do reconhecimento</span>
                      <span
                        className="font-bold px-2 py-0.5 rounded text-white"
                        style={{ background: confColor(selectedNode.recog_confidence) }}
                      >
                        {confLabel(selectedNode.recog_confidence)}
                      </span>
                    </div>
                    <div className="text-muted-foreground">
                      Origem:{" "}
                      {selectedNode.recog_source === "text"
                        ? "rótulo de texto"
                        : selectedNode.recog_source === "shape"
                          ? "id/class do shape"
                          : "inserido automaticamente"}
                    </div>
                    {selectedNode.recog_issues?.map((iss, i) => (
                      <div key={i} className="flex gap-1 text-foreground">
                        <AlertTriangle
                          className="h-3 w-3 mt-0.5 shrink-0"
                          style={{ color: "hsl(0 75% 55%)" }}
                        />
                        <span>{iss}</span>
                      </div>
                    ))}
                    <Button
                      variant="ghost"
                      size="sm"
                      className="w-full h-7 text-xs"
                      onClick={() =>
                        updateNode(selectedNode.id, {
                          recog_confidence: undefined,
                          recog_source: undefined,
                          recog_issues: undefined,
                        } as Partial<FNode>)
                      }
                    >
                      Marcar como revisado
                    </Button>
                  </div>
                )}
                {selectedNode.type !== "olt" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => startLink(selectedNode.id)}
                  >
                    <Link2 className="h-4 w-4 mr-2" /> Conectar a outro nó
                  </Button>
                )}
                {selectedNode.type === "olt" && (
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => startLink(selectedNode.id)}
                  >
                    <Link2 className="h-4 w-4 mr-2" /> Conectar saída
                  </Button>
                )}
                {selectedNode.type !== "olt" && (
                  <Button
                    variant="destructive"
                    size="sm"
                    className="w-full"
                    onClick={() => deleteNode(selectedNode.id)}
                  >
                    <Trash2 className="h-4 w-4 mr-2" /> Excluir nó
                  </Button>
                )}
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full"
                  onClick={() => setSelNode(null)}
                >
                  <MousePointer2 className="h-4 w-4 mr-2" /> Desmarcar
                </Button>
              </>
            )}

            {selectedEdge && (
              <>
                <div>
                  <Label className="text-xs">Comprimento (m)</Label>
                  <Input
                    type="number"
                    value={selectedEdge.length_m}
                    onChange={(e) =>
                      updateEdge(selectedEdge.id, { length_m: Number(e.target.value) })
                    }
                  />
                </div>
                <div>
                  <Label className="text-xs">Conectores</Label>
                  <Input
                    type="number"
                    value={selectedEdge.connectors ?? 2}
                    onChange={(e) =>
                      updateEdge(selectedEdge.id, { connectors: Number(e.target.value) })
                    }
                  />
                </div>
                <Button
                  variant="destructive"
                  size="sm"
                  className="w-full"
                  onClick={() => deleteEdge(selectedEdge.id)}
                >
                  <Trash2 className="h-4 w-4 mr-2" /> Excluir conexão
                </Button>
              </>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function escapeHtml(s: string) {
  return (s || "").replace(
    /[&<>"']/g,
    (c) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;",
      })[c] as string,
  );
}

// ---------------- Auto-recognition ----------------
type ClassifyResult = {
  type: NodeType;
  ratio?: number;
  confidence: number; // 0..1 — how sure we are about (type, ratio)
  issues?: string[]; // human-readable warnings
};
function classifyHint(t: string): ClassifyResult | null {
  const s = (t || "").trim();
  if (!s) return null;
  const m = s.match(/(?:spl(?:itter)?|sp)\D*1\s*[x×:]\s*(\d+)/i);
  if (m) {
    const r = Number(m[1]);
    if ([2, 4, 8, 16, 32].includes(r)) return { type: "splitter", ratio: r, confidence: 0.95 };
    return {
      type: "splitter",
      ratio: 8,
      confidence: 0.55,
      issues: [`Razão "1x${r}" não suportada — usando 1x8`],
    };
  }
  if (/\bolt\b/i.test(s)) return { type: "olt", confidence: 0.95 };
  if (/spl(?:itter)?\b|\bsp\b/i.test(s))
    return {
      type: "splitter",
      ratio: 8,
      confidence: 0.6,
      issues: ["Splitter sem razão explícita — assumido 1x8"],
    };
  if (/\bcto\b|terminal[\s_-]*[oó]ptic/i.test(s)) return { type: "cto", confidence: 0.9 };
  if (/emenda|splice|\bceo\b/i.test(s)) return { type: "emenda", confidence: 0.9 };
  if (/caixa/i.test(s))
    return {
      type: "emenda",
      confidence: 0.5,
      issues: ['Termo genérico "caixa" — confirme se é emenda ou CTO'],
    };
  if (/cliente|assinante|\bont\b/i.test(s)) return { type: "cliente", confidence: 0.9 };
  if (/\bonu\b/i.test(s)) return { type: "cliente", confidence: 0.75 };
  return null;
}

function recognizeSvg(svgText: string): Diagram | null {
  if (typeof document === "undefined") return null;
  const host = document.createElement("div");
  host.style.position = "absolute";
  host.style.left = "-99999px";
  host.style.top = "0";
  host.style.width = "1200px";
  host.style.height = "700px";
  host.innerHTML = svgText;
  document.body.appendChild(host);
  const liveSvg = host.querySelector("svg") as SVGSVGElement | null;
  if (!liveSvg) {
    document.body.removeChild(host);
    return null;
  }

  const vb = liveSvg.viewBox?.baseVal;
  let vbX = 0,
    vbY = 0,
    vbW = 1200,
    vbH = 700;
  if (vb && vb.width && vb.height) {
    vbX = vb.x;
    vbY = vb.y;
    vbW = vb.width;
    vbH = vb.height;
  } else {
    vbW = parseFloat(liveSvg.getAttribute("width") || "1200") || 1200;
    vbH = parseFloat(liveSvg.getAttribute("height") || "700") || 700;
  }
  const sx = 1200 / vbW;
  const sy = 700 / vbH;

  function centerOf(el: SVGGraphicsElement): { x: number; y: number } | null {
    try {
      const b = el.getBBox();
      const ctm = el.getCTM();
      const rootInv = liveSvg!.getCTM()?.inverse();
      const pt = liveSvg!.createSVGPoint();
      pt.x = b.x + b.width / 2;
      pt.y = b.y + b.height / 2;
      const inSvg = ctm && rootInv ? pt.matrixTransform(ctm).matrixTransform(rootInv) : pt;
      return { x: (inSvg.x - vbX) * sx, y: (inSvg.y - vbY) * sy };
    } catch {
      return null;
    }
  }

  type Match = {
    type: NodeType;
    label: string;
    ratio?: number;
    x: number;
    y: number;
    confidence: number;
    source: "text" | "shape";
    issues?: string[];
  };
  const matches: Match[] = [];
  const seenNear = (t: NodeType, x: number, y: number) =>
    matches.some((m) => m.type === t && Math.hypot(m.x - x, m.y - y) < 24);

  // Pass 1: <text> labels
  liveSvg.querySelectorAll("text").forEach((t) => {
    const txt = (t.textContent || "").trim();
    const cls = classifyHint(txt);
    if (!cls) return;
    const p = centerOf(t as SVGGraphicsElement);
    if (!p) return;
    if (seenNear(cls.type, p.x, p.y)) return;
    matches.push({
      type: cls.type,
      label: txt.slice(0, 32),
      ratio: cls.ratio,
      x: p.x,
      y: p.y,
      confidence: cls.confidence,
      source: "text",
      issues: cls.issues,
    });
  });

  // Pass 2: id / class / data-type hints on shapes and groups
  liveSvg.querySelectorAll("[id],[class],[data-type]").forEach((node) => {
    const el = node as SVGGraphicsElement;
    const hint = [
      el.id,
      el.getAttribute("class") || "",
      el.getAttribute("data-type") || "",
      el.getAttribute("data-name") || "",
    ].join(" ");
    const cls = classifyHint(hint);
    if (!cls) return;
    const p = centerOf(el);
    if (!p) return;
    if (seenNear(cls.type, p.x, p.y)) return;
    // Shape/id hints are less reliable than visible <text> labels
    const shapeConf = Math.max(0.4, cls.confidence - 0.2);
    const issues = [...(cls.issues ?? [])];
    issues.push("Reconhecido por id/class — confirme tipo");
    matches.push({
      type: cls.type,
      label: (el.id || cls.type).slice(0, 32),
      ratio: cls.ratio,
      x: p.x,
      y: p.y,
      confidence: shapeConf,
      source: "shape",
      issues,
    });
  });

  document.body.removeChild(host);

  if (matches.length === 0) return null;

  const nodes: FNode[] = matches.map((m) => ({
    id: uid(),
    type: m.type,
    label: m.label || NODE_LABEL[m.type],
    x: Math.max(40, Math.min(1160, m.x)),
    y: Math.max(40, Math.min(660, m.y)),
    ...(m.type === "splitter" ? { ratio: m.ratio ?? 8 } : {}),
    ...(m.type === "emenda" ? { extra_loss_db: SPLICE_LOSS } : {}),
    recog_confidence: m.confidence,
    recog_source: m.source,
    recog_issues: m.issues && m.issues.length ? m.issues : undefined,
  }));

  return { nodes, edges: rebuildEdges(nodes) };
}

// Build parent→child edges by topology rank + nearest-neighbour.
function rebuildEdges(nodes: FNode[]): FEdge[] {
  const order: NodeType[] = ["olt", "splitter", "emenda", "cto", "cliente"];
  const rank = (t: NodeType) => order.indexOf(t);
  const edges: FEdge[] = [];
  for (const n of nodes) {
    if (n.type === "olt") continue;
    let best: FNode | null = null;
    let bestD = Infinity;
    for (const p of nodes) {
      if (p.id === n.id) continue;
      if (rank(p.type) >= rank(n.type)) continue;
      const d = Math.hypot(p.x - n.x, p.y - n.y);
      if (d < bestD) {
        bestD = d;
        best = p;
      }
    }
    if (best) {
      edges.push({
        id: uid(),
        from: best.id,
        to: n.id,
        length_m: Math.max(10, Math.round(bestD / 4) * 5),
        connectors: 2,
      });
    }
  }
  return edges;
}

function renderPowerTable(
  d: Diagram,
  powers: { rx: Record<string, number>; tx: Record<string, number> },
) {
  if (!d.nodes.length) return "";
  const rows = d.nodes
    .map((n) => {
      const rx = powers.rx[n.id];
      const tx = powers.tx[n.id];
      return `<tr>
      <td>${escapeHtml(n.label)}</td>
      <td>${NODE_LABEL[n.type]}${n.type === "splitter" ? ` 1x${n.ratio}` : ""}</td>
      <td>${rx !== undefined ? rx.toFixed(2) + " dBm" : "—"}</td>
      <td>${tx !== undefined ? tx.toFixed(2) + " dBm" : "—"}</td>
    </tr>`;
    })
    .join("");
  return `<table><thead><tr><th>Nó</th><th>Tipo</th><th>Sinal RX</th><th>Saída TX</th></tr></thead><tbody>${rows}</tbody></table>`;
}
