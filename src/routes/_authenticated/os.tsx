import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ClipboardList, Search, Upload, Image as ImageIcon, Video, FileIcon, X } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/os")({
  head: () => ({ meta: [{ title: "Ordens de Serviço — ISP Manager" }] }),
  component: OSPage,
});

type OSTipo = "instalacao" | "reparo" | "manutencao" | "mudanca_endereco" | "desativacao" | "visita_tecnica" | "outros"
type OSStatus = "agendada" | "aberta" | "em_execucao" | "em_deslocamento" | "aguardando_material" | "concluida" | "cancelada"

type Material = {
  id?: string;
  descricao: string;
  quantidade: number;
  unidade: string;
};

type OS = {
  id: string;
  numero: number;
  cliente_id: string;
  tipo: OSTipo;
  status: OSStatus;
  descricao: string;
  tecnico_id: string | null;
  cto_ref: string | null;
  porta_cto: number | null;
  endereco_atendimento: string | null;
  data_agendada: string | null;
  data_inicio: string | null;
  data_conclusao: string | null;
  assinatura_cliente: string | null;
  observacoes_cliente: string | null;
  observacoes_internas: string | null;
  clientes?: { nome: string } | null;
};

const TIPO_LABEL: Record<OSTipo, string> = {
  instalacao: "Instalação",
  manutencao: "Manutenção/Reparo",
  mudanca_endereco: "Mudança de endereço",
  visita_tecnica: "Visita_técnica",
  outros: "Outros",
};

const STATUS_LABEL: Record<OSStatus, string> = {
  agendada: "Agendada",
  aberta: "Aberta",
  em_execucao: "Em_execução",
  em_deslocamento: "Em_deslocamento",
  aguardando_material: "Aguardando_material",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const STATUS_VARIANT: Record<OSStatus, "default" | "secondary" | "destructive" | "outline"> = {
  agendada: "outline",
  aberta: "secondary",
  em_execucao: "default",
  em_deslocamento: "default",
  aguardando_material: "default",
  concluida: "secondary",
  cancelada: "destructive",
};

const osSchema = z.object({
  cliente_id: z.string().uuid("Selecione um cliente"),
  tipo: z.enum(["instalacao", "manutencao", "mudanca_endereco", "visita_tecnica"]),
  status: z.enum(["agendada", "aberta", "em_execucao", "em_deslocamento", "aguardando_material", "concluida", "cancelada"]),
  descricao: z.string().trim().min(3, "Descreva o serviço").max(2000),
  tecnico_id: z.string().uuid().nullable(),
  cto_ref: z.string().max(80).nullable(),
  porta_cto: z.number().int().min(0).max(999).nullable(),
  endereco_atendimento: z.string().max(300).nullable(),
  data_agendada: z.string().nullable(),
  data_inicio: z.string().nullable(),
  data_conclusao: z.string().nullable(),
  assinatura_cliente: z.string().max(120).nullable(),
  observacoes_cliente: z.string().max(1000).nullable(),
  observacoes_internas: z.string().max(1000).nullable(),
});

function toDtLocal(v: string | null | undefined) {
  if (!v) return "";
  const d = new Date(v);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function OSPage() {
  const qc = useQueryClient();
  const { isAdmin, hasRole } = useAuth();
  const canCreate = isAdmin || hasRole("atendente");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<OS | null>(null);
  const [materiais, setMateriais] = useState<Material[]>([]);
  const [filter, setFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState<OSStatus | "todos">("todos");
  const [clienteId, setClienteId] = useState<string>("");
  const [endereco, setEndereco] = useState<string>("");
  const [uploading, setUploading] = useState(false);

  const { data: ordens = [], isLoading } = useQuery({
    queryKey: ["ordens_servico"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("ordens_servico")
        .select("*, clientes(nome)")
        .order("numero", { ascending: false });
      if (error) throw error;
      return data as unknown as OS[];
    },
  });

  const { data: clientes = [] } = useQuery({
    queryKey: ["clientes-min"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("id, nome, endereco, numero, bairro, cidade, estado, cep")
        .order("nome");
      if (error) throw error;
      return data as {
        id: string; nome: string;
        endereco: string | null; numero: string | null; bairro: string | null;
        cidade: string | null; estado: string | null; cep: string | null;
      }[];
    },
  });

  const { data: tecnicos = [] } = useQuery({
    queryKey: ["tecnicos"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, profiles(full_name)")
        .eq("role", "tecnico");
      if (error) throw error;
      return (data ?? []).map((r) => ({
        id: r.user_id as string,
        nome: ((r as { profiles?: { full_name?: string } }).profiles?.full_name) || "Técnico",
      }));
    },
  });

  const { data: materiaisEdit = [] } = useQuery({
    queryKey: ["os_materiais", editing?.id],
    enabled: !!editing?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_materiais")
        .select("*")
        .eq("os_id", editing!.id);
      if (error) throw error;
      return data as Material[];
    },
  });

  function fullAddress(c: (typeof clientes)[number] | undefined) {
    if (!c) return "";
    const linha1 = [c.endereco, c.numero].filter(Boolean).join(", ");
    const linha2 = [c.bairro, c.cidade && c.estado ? `${c.cidade}/${c.estado}` : c.cidade || c.estado, c.cep]
      .filter(Boolean).join(" - ");
    return [linha1, linha2].filter(Boolean).join(" — ");
  }

  function openNew() {
    setEditing(null);
    setMateriais([]);
    setClienteId("");
    setEndereco("");
    setOpen(true);
  }

  function openEdit(o: OS) {
    setEditing(o);
    setMateriais([]);
    setClienteId(o.cliente_id);
    setEndereco(o.endereco_atendimento ?? fullAddress(clientes.find((c) => c.id === o.cliente_id)));
    setOpen(true);
  }

  function onClienteChange(id: string) {
    setClienteId(id);
    const c = clientes.find((x) => x.id === id);
    setEndereco(fullAddress(c));
  }

  // Evidências
  const { data: evidencias = [] } = useQuery({
    queryKey: ["os_evidencias", editing?.id],
    enabled: !!editing?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("os_evidencias")
        .select("*")
        .eq("os_id", editing!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const withUrls = await Promise.all((data ?? []).map(async (e) => {
        const { data: signed } = await supabase.storage
          .from("os-evidencias").createSignedUrl(e.path, 3600);
        return { ...e, url: signed?.signedUrl ?? null };
      }));
      return withUrls as Array<{ id: string; path: string; tipo: string; mime: string | null; legenda: string | null; url: string | null }>;
    },
  });

  async function uploadEvidencias(files: FileList | null) {
    if (!files || !editing?.id) return;
    setUploading(true);
    try {
      const { data: u } = await supabase.auth.getUser();
      const uid = u.user?.id;
      if (!uid) throw new Error("Sessão expirada");
      for (const file of Array.from(files)) {
        const ext = file.name.split(".").pop() || "bin";
        const path = `${editing.id}/${crypto.randomUUID()}.${ext}`;
        const { error: upErr } = await supabase.storage
          .from("os-evidencias").upload(path, file, { contentType: file.type });
        if (upErr) throw upErr;
        const tipo = file.type.startsWith("image/") ? "foto" : file.type.startsWith("video/") ? "video" : "outro";
        const { error: dbErr } = await supabase.from("os_evidencias").insert({
          os_id: editing.id, path, tipo, mime: file.type, tamanho: file.size, uploaded_by: uid,
        });
        if (dbErr) throw dbErr;
      }
      toast.success("Evidências enviadas");
      qc.invalidateQueries({ queryKey: ["os_evidencias", editing.id] });
    } catch (e) {
      toast.error((e as Error).message);
    } finally {
      setUploading(false);
    }
  }

  async function removeEvidencia(id: string, path: string) {
    if (!confirm("Remover esta evidência?")) return;
    await supabase.storage.from("os-evidencias").remove([path]);
    const { error } = await supabase.from("os_evidencias").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Evidência removida");
    qc.invalidateQueries({ queryKey: ["os_evidencias", editing?.id] });
  }

  // Sync loaded materials when editing
  useMemo(() => {
    if (editing?.id && materiaisEdit.length > 0 && materiais.length === 0) {
      setMateriais(materiaisEdit);
    }
  }, [editing?.id, materiaisEdit, materiais.length]);

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const parsed = osSchema.parse({
        cliente_id: form.get("cliente_id"),
        tipo: form.get("tipo"),
        status: form.get("status"),
        descricao: form.get("descricao"),
        tecnico_id: (form.get("tecnico_id") as string) || null,
        cto_ref: (form.get("cto_ref") as string) || null,
        porta_cto: form.get("porta_cto") ? Number(form.get("porta_cto")) : null,
        endereco_atendimento: (form.get("endereco_atendimento") as string) || null,
        data_agendada: (form.get("data_agendada") as string) || null,
        data_inicio: (form.get("data_inicio") as string) || null,
        data_conclusao: (form.get("data_conclusao") as string) || null,
        assinatura_cliente: (form.get("assinatura_cliente") as string) || null,
        observacoes_cliente: (form.get("observacoes_cliente") as string) || null,
        observacoes_internas: (form.get("observacoes_internas") as string) || null,
      });

      const payload = {
        ...parsed,
        data_agendada: parsed.data_agendada ? new Date(parsed.data_agendada).toISOString() : null,
        data_inicio: parsed.data_inicio ? new Date(parsed.data_inicio).toISOString() : null,
        data_conclusao: parsed.data_conclusao ? new Date(parsed.data_conclusao).toISOString() : null,
      };

      let osId: string;
      if (editing) {
        const { error } = await supabase.from("ordens_servico").update(payload).eq("id", editing.id);
        if (error) throw error;
        osId = editing.id;
        await supabase.from("os_materiais").delete().eq("os_id", osId);
      } else {
        const { data: u } = await supabase.auth.getUser();
        const { data, error } = await supabase
          .from("ordens_servico")
          .insert({ ...payload, created_by: u.user?.id })
          .select("id")
          .single();
        if (error) throw error;
        osId = data.id as string;
      }

      const mats = materiais.filter((m) => m.descricao.trim());
      if (mats.length > 0) {
        const { error: e2 } = await supabase
          .from("os_materiais")
          .insert(mats.map((m) => ({ ...m, valor_unitario: 0, os_id: osId })));
        if (e2) throw e2;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "OS atualizada" : "OS criada");
      qc.invalidateQueries({ queryKey: ["ordens_servico"] });
      setOpen(false);
      setEditing(null);
      setMateriais([]);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("ordens_servico").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("OS removida");
      qc.invalidateQueries({ queryKey: ["ordens_servico"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const filtered = ordens.filter((o) => {
    const t = filter.toLowerCase();
    const matchT = !t ||
      String(o.numero).includes(t) ||
      o.clientes?.nome?.toLowerCase().includes(t) ||
      o.descricao?.toLowerCase().includes(t);
    const matchS = statusFilter === "todos" || o.status === statusFilter;
    return matchT && matchS;
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ordens de Serviço</h1>
          <p className="text-muted-foreground">Gerencie instalações, manutenções e visitas técnicas</p>
        </div>
        {canCreate && (
          <Button onClick={openNew}><Plus className="h-4 w-4 mr-2" /> Nova OS</Button>
        )}
      </div>

      <Card>
        <CardContent className="p-4 space-y-4">
          <div className="flex flex-wrap gap-3">
            <div className="relative flex-1 min-w-[200px]">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                className="pl-9"
                placeholder="Buscar por número, cliente ou descrição..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
              />
            </div>
            <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as OSStatus | "todos")}>
              <SelectTrigger className="w-[180px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {(Object.keys(STATUS_LABEL) as OSStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>{STATUS_LABEL[s]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <ClipboardList className="h-10 w-10 mx-auto mb-2 opacity-50" />
              Nenhuma OS encontrada
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>#</TableHead>
                  <TableHead>Cliente</TableHead>
                  <TableHead>Tipo</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Agendada</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono">#{o.numero}</TableCell>
                    <TableCell className="font-medium">{o.clientes?.nome ?? "—"}</TableCell>
                    <TableCell>{TIPO_LABEL[o.tipo]}</TableCell>
                    <TableCell><Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge></TableCell>
                    <TableCell className="text-sm">
                      {o.data_agendada ? new Date(o.data_agendada).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(o)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button variant="ghost" size="icon" onClick={() => {
                          if (confirm(`Remover OS #${o.numero}?`)) remove.mutate(o.id);
                        }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      )}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Dialog open={open} onOpenChange={(o) => {
        setOpen(o);
        if (!o) { setEditing(null); setMateriais([]); }
      }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? `Editar OS #${editing.numero}` : "Nova Ordem de Serviço"}</DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); save.mutate(new FormData(e.currentTarget)); }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cliente_id">Cliente *</Label>
                <select
                  id="cliente_id"
                  name="cliente_id"
                  value={clienteId}
                  onChange={(e) => onClienteChange(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Selecione...</option>
                  {clientes.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tipo">Tipo *</Label>
                <select
                  id="tipo"
                  name="tipo"
                  defaultValue={editing?.tipo ?? "instalacao"}
                  required
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {(Object.keys(TIPO_LABEL) as OSTipo[]).map((t) => (
                    <option key={t} value={t}>{TIPO_LABEL[t]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="status">Status *</Label>
                <select
                  id="status"
                  name="status"
                  defaultValue={editing?.status ?? "aberta"}
                  required
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  {(Object.keys(STATUS_LABEL) as OSStatus[]).map((s) => (
                    <option key={s} value={s}>{STATUS_LABEL[s]}</option>
                  ))}
                </select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="tecnico_id">Técnico</Label>
                <select
                  id="tecnico_id"
                  name="tecnico_id"
                  defaultValue={editing?.tecnico_id ?? ""}
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">— Não atribuído —</option>
                  {tecnicos.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição do serviço *</Label>
              <Textarea id="descricao" name="descricao" defaultValue={editing?.descricao ?? ""} required rows={3} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endereco_atendimento">Endereço de atendimento</Label>
              <Input
                id="endereco_atendimento"
                name="endereco_atendimento"
                value={endereco}
                onChange={(e) => setEndereco(e.target.value)}
                placeholder="Preenchido automaticamente a partir do cliente"
              />
              <p className="text-xs text-muted-foreground">Puxado do cadastro do cliente. Edite se o atendimento for em outro endereço.</p>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cto_ref">CTO/Caixa</Label>
                <Input id="cto_ref" name="cto_ref" defaultValue={editing?.cto_ref ?? ""} placeholder="Ex: CTO-001" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="porta_cto">Porta</Label>
                <Input id="porta_cto" name="porta_cto" type="number" min="0" defaultValue={editing?.porta_cto ?? ""} />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="data_agendada">Agendada</Label>
                <Input id="data_agendada" name="data_agendada" type="datetime-local" defaultValue={toDtLocal(editing?.data_agendada)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_inicio">Início</Label>
                <Input id="data_inicio" name="data_inicio" type="datetime-local" defaultValue={toDtLocal(editing?.data_inicio)} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_conclusao">Conclusão</Label>
                <Input id="data_conclusao" name="data_conclusao" type="datetime-local" defaultValue={toDtLocal(editing?.data_conclusao)} />
              </div>
            </div>

            {/* Materiais */}
            <div className="space-y-2 border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <Label>Equipamentos / materiais usados</Label>
                <Button type="button" size="sm" variant="outline" onClick={() => setMateriais((m) => [...m, { descricao: "", quantidade: 1, unidade: "un", valor_unitario: 0 }])}>
                  <Plus className="h-3 w-3 mr-1" /> Adicionar
                </Button>
              </div>
              {materiais.length === 0 ? (
                <p className="text-sm text-muted-foreground py-2">Nenhum material adicionado</p>
              ) : (
                <div className="space-y-2">
                  {materiais.map((m, i) => (
                    <div key={i} className="grid grid-cols-12 gap-2 items-end">
                      <div className="col-span-5">
                        <Input placeholder="Descrição" value={m.descricao} onChange={(e) => {
                          const v = e.target.value;
                          setMateriais((arr) => arr.map((x, j) => j === i ? { ...x, descricao: v } : x));
                        }} />
                      </div>
                      <div className="col-span-2">
                        <Input type="number" step="0.01" placeholder="Qtd" value={m.quantidade} onChange={(e) => {
                          const v = Number(e.target.value);
                          setMateriais((arr) => arr.map((x, j) => j === i ? { ...x, quantidade: v } : x));
                        }} />
                      </div>
                      <div className="col-span-2">
                        <Input placeholder="un" value={m.unidade} onChange={(e) => {
                          const v = e.target.value;
                          setMateriais((arr) => arr.map((x, j) => j === i ? { ...x, unidade: v } : x));
                        }} />
                      </div>
                      <div className="col-span-1">
                        <Button type="button" variant="ghost" size="icon" onClick={() => setMateriais((arr) => arr.filter((_, j) => j !== i))}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="assinatura_cliente">Assinatura / nome do recebedor</Label>
              <Input id="assinatura_cliente" name="assinatura_cliente" defaultValue={editing?.assinatura_cliente ?? ""} placeholder="Nome de quem assinou no local" />
            </div>

            {/* Evidências */}
            {editing?.id ? (
              <div className="space-y-2 border rounded-lg p-3">
                <div className="flex items-center justify-between flex-wrap gap-2">
                  <Label>Evidências (fotos / vídeos)</Label>
                  <label className="inline-flex">
                    <Button type="button" size="sm" variant="outline" asChild>
                      <span className="cursor-pointer">
                        <Upload className="h-3 w-3 mr-1" /> {uploading ? "Enviando..." : "Adicionar arquivos"}
                      </span>
                    </Button>
                    <input
                      type="file"
                      accept="image/*,video/*"
                      multiple
                      className="hidden"
                      disabled={uploading}
                      onChange={(e) => { uploadEvidencias(e.target.files); e.target.value = ""; }}
                    />
                  </label>
                </div>
                {evidencias.length === 0 ? (
                  <p className="text-sm text-muted-foreground py-2">Nenhuma evidência anexada</p>
                ) : (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    {evidencias.map((ev) => (
                      <div key={ev.id} className="relative group border rounded-md overflow-hidden bg-muted/30">
                        {ev.tipo === "foto" && ev.url ? (
                          <a href={ev.url} target="_blank" rel="noreferrer">
                            <img src={ev.url} alt={ev.legenda ?? "Evidência"} className="w-full h-28 object-cover" />
                          </a>
                        ) : ev.tipo === "video" && ev.url ? (
                          <video src={ev.url} controls className="w-full h-28 object-cover" />
                        ) : (
                          <a href={ev.url ?? "#"} target="_blank" rel="noreferrer" className="flex flex-col items-center justify-center h-28 text-muted-foreground">
                            <FileIcon className="h-6 w-6" />
                            <span className="text-xs mt-1">Arquivo</span>
                          </a>
                        )}
                        <div className="absolute top-1 left-1 bg-background/80 rounded px-1 py-0.5 text-xs flex items-center gap-1">
                          {ev.tipo === "foto" ? <ImageIcon className="h-3 w-3" /> : ev.tipo === "video" ? <Video className="h-3 w-3" /> : <FileIcon className="h-3 w-3" />}
                        </div>
                        <button
                          type="button"
                          onClick={() => removeEvidencia(ev.id, ev.path)}
                          className="absolute top-1 right-1 bg-destructive text-destructive-foreground rounded p-1 opacity-0 group-hover:opacity-100 transition"
                          aria-label="Remover evidência"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground border rounded-lg p-3">Salve a OS para poder anexar fotos e vídeos como evidência.</p>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="observacoes_cliente">Observações do cliente</Label>
                <Textarea id="observacoes_cliente" name="observacoes_cliente" defaultValue={editing?.observacoes_cliente ?? ""} rows={2} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="observacoes_internas">Observações internas</Label>
                <Textarea id="observacoes_internas" name="observacoes_internas" defaultValue={editing?.observacoes_internas ?? ""} rows={2} />
              </div>
            </div>

            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar OS"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
