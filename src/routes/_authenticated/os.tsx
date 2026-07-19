import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useMemo, useState, useRef } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, ClipboardList, Search } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useClienteData } from "@/hooks/use-cliente-data";

export const Route = createFileRoute("/_authenticated/os")({
  head: () => ({ meta: [{ title: "Ordens de Serviço — ISP Manager" }] }),
  component: OSPage,
});

type OSTipo = "instalacao" | "manutencao" | "mudanca_endereco" | "visita_tecnica";
type OSStatus =
  | "aberta"
  | "agendada"
  | "em_deslocamento"
  | ""
  | "aguardando_material"
  | "concluida"
  | "cancelada";

type Material = {
  id?: string;
  descricao: string;
  quantidade: number;
  unidade: string;
  valor_unitario: number;
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
  valor: number | null;
  forma_pagamento: string | null;
  assinatura_cliente: string | null;
  observacoes_cliente: string | null;
  observacoes_internas: string | null;
  clientes?: { nome: string } | null;
};

const TIPO_LABEL: Record<OSTipo, string> = {
  instalacao: "Instalação",
  manutencao: "Manutenção/Reparo",
  mudanca_endereco: "Mudança de endereço",
  visita_tecnica: "Visita técnica",
};

const STATUS_LABEL: Record<OSStatus, string> = {
  aberta: "Aberta",
  agendada: "Agendada",
  em_andamento: "Em andamento",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

const STATUS_VARIANT: Record<OSStatus, "default" | "secondary" | "destructive" | "outline"> = {
  aberta: "outline",
  agendada: "secondary",
  em_andamento: "default",
  concluida: "secondary",
  cancelada: "destructive",
};

const osSchema = z.object({
  cliente_id: z.string().uuid("Selecione um cliente"),
  tipo: z.enum(["instalacao", "manutencao", "mudanca_endereco", "visita_tecnica"]),
  status: z.enum(["aberta", "agendada", "em_andamento", "concluida", "cancelada"]),
  descricao: z.string().trim().min(3, "Descreva o serviço").max(2000),
  tecnico_id: z.string().uuid().nullable(),
  cto_ref: z.string().max(80).nullable(),
  porta_cto: z.number().int().min(0).max(999).nullable(),
  endereco_atendimento: z.string().max(300).nullable(),
  data_agendada: z.string().nullable(),
  data_inicio: z.string().nullable(),
  data_conclusao: z.string().nullable(),
  valor: z.number().min(0).max(99999),
  forma_pagamento: z.string().max(60).nullable(),
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
  const [selectedClientId, setSelectedClientId] = useState("");
  const [enderecoPreenchido, setEnderecoPreenchido] = useState("");
  const enderecoInputRef = useRef<HTMLInputElement>(null);

  const { data: clienteData } = useQuery({
    queryKey: ['cliente-completo', selectedClientId],
    enabled: !!selectedClientId,
    queryFn: async () => {
      if (!selectedClientId) return null;
      const { data, error } = await supabase
        .from('clientes')
        .select('endereco, numero, bairro, cidade, estado, cep')
        .eq('id', selectedClientId)
        .single();
      if (error) throw error;
      return data;
    }
  });

  // Quando cliente muda, preencher endereço automaticamente
  useEffect(() => {
    if (clienteData) {
      const partes = [
        clienteData.endereco,
        clienteData.numero,
        clienteData.bairro,
        clienteData.cidade,
        clienteData.estado,
        clienteData.cep
      ].filter(Boolean);
      const enderecoFormatado = partes.join(', ');
      setEnderecoPreenchido(enderecoFormatado);
      if (enderecoInputRef.current) {
        enderecoInputRef.current.value = enderecoFormatado;
      }
    }
  }, [clienteData]);

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
      const { data, error } = await supabase.from("clientes").select("id, nome").order("nome");
      if (error) throw error;
      return data as { id: string; nome: string }[];
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
        nome: (r as { profiles?: { full_name?: string } }).profiles?.full_name || "Técnico",
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

  function openNew() {
    setEditing(null);
    setMateriais([]);
    setSelectedClientId("");
    setEnderecoPreenchido("");
    setOpen(true);
  }

  function openEdit(o: OS) {
    setEditing(o);
    setMateriais([]);
    setSelectedClientId(o.cliente_id);
    setEnderecoPreenchido(o.endereco_atendimento || "");
    setOpen(true);
  }

  useEffect(() => {
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
        valor: Number(form.get("valor") || 0),
        forma_pagamento: (form.get("forma_pagamento") as string) || null,
        assinatura_cliente: (form.get("assinatura_cliente") as string) || null,
        observacoes_cliente: (form.get("observacoes_cliente") as string) || null,
        observacoes_internas: (form.get("observacoes_internas") as string) || null,
      });

      const payload = {
        ...parsed,
        data_agendada: parsed.data_agendada ? new Date(parsed.data_agendada).toISOString() : null,
        data_inicio: parsed.data_inicio ? new Date(parsed.data_inicio).toISOString() : null,
        data_conclusao: parsed.data_conclusao
          ? new Date(parsed.data_conclusao).toISOString()
          : null,
      };

      let osId: string;
      if (editing) {
        const { error } = await supabase
          .from("ordens_servico")
          .update(payload)
          .eq("id", editing.id);
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
          .insert(mats.map((m) => ({ ...m, os_id: osId })));
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
    const matchT =
      !t ||
      String(o.numero).includes(t) ||
      o.clientes?.nome?.toLowerCase().includes(t) ||
      o.descricao?.toLowerCase().includes(t);
    const matchS = statusFilter === "todos" || o.status === statusFilter;
    return matchT && matchS;
  });

  const totalMat = materiais.reduce((s, m) => s + m.quantidade * m.valor_unitario, 0);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Ordens de Serviço</h1>
          <p className="text-muted-foreground">
            Gerencie instalações, manutenções e visitas técnicas
          </p>
        </div>
        {canCreate && (
          <Button onClick={openNew}>
            <Plus className="h-4 w-4 mr-2" /> Nova OS
          </Button>
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
            <Select
              value={statusFilter}
              onValueChange={(v) => setStatusFilter(v as OSStatus | "todos")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="todos">Todos os status</SelectItem>
                {(Object.keys(STATUS_LABEL) as OSStatus[]).map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUS_LABEL[s]}
                  </SelectItem>
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
                  <TableHead>Valor</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((o) => (
                  <TableRow key={o.id}>
                    <TableCell className="font-mono">#{o.numero}</TableCell>
                    <TableCell className="font-medium">{o.clientes?.nome ?? "—"}</TableCell>
                    <TableCell>{TIPO_LABEL[o.tipo]}</TableCell>
                    <TableCell>
                      <Badge variant={STATUS_VARIANT[o.status]}>{STATUS_LABEL[o.status]}</Badge>
                    </TableCell>
                    <TableCell className="text-sm">
                      {o.data_agendada ? new Date(o.data_agendada).toLocaleString("pt-BR") : "—"}
                    </TableCell>
                    <TableCell>R$ {Number(o.valor ?? 0).toFixed(2)}</TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(o)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Remover OS #${o.numero}?`)) remove.mutate(o.id);
                          }}
                        >
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

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) {
            setEditing(null);
            setMateriais([]);
            setSelectedClientId("");
            setEnderecoPreenchido("");
          }
        }}
      >
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editing ? `Editar OS #${editing.numero}` : "Nova Ordem de Serviço"}
            </DialogTitle>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(new FormData(e.currentTarget));
            }}
            className="space-y-4"
          >
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cliente_id">Cliente *</Label>
                <select
                  id="cliente_id"
                  name="cliente_id"
                  value={selectedClientId}
                  onChange={(e) => setSelectedClientId(e.target.value)}
                  required
                  className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm"
                >
                  <option value="">Selecione...</option>
                  {clientes.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.nome}
                    </option>
                  ))}
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
                    <option key={t} value={t}>
                      {TIPO_LABEL[t]}
                    </option>
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
                    <option key={s} value={s}>
                      {STATUS_LABEL[s]}
                    </option>
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
                  {tecnicos.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.nome}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="descricao">Descrição do serviço *</Label>
              <Textarea
                id="descricao"
                name="descricao"
                defaultValue={editing?.descricao ?? ""}
                required
                rows={3}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="endereco_atendimento">Endereço de atendimento</Label>
              <Input
                ref={enderecoInputRef}
                id="endereco_atendimento"
                name="endereco_atendimento"
                defaultValue={editing?.endereco_atendimento ?? ""}
                placeholder="Deixe em branco para usar o do cliente"
              />
              {enderecoPreenchido && (
                <p className="text-xs text-muted-foreground">
                  📍 Preenchido automaticamente: {enderecoPreenchido}
                </p>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="cto_ref">CTO/Caixa</Label>
                <Input
                  id="cto_ref"
                  name="cto_ref"
                  defaultValue={editing?.cto_ref ?? ""}
                  placeholder="Ex: CTO-001"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="porta_cto">Porta</Label>
                <Input
                  id="porta_cto"
                  name="porta_cto"
                  type="number"
                  min="0"
                  defaultValue={editing?.porta_cto ?? ""}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="data_agendada">Agendada</Label>
                <Input
                  id="data_agendada"
                  name="data_agendada"
                  type="datetime-local"
                  defaultValue={toDtLocal(editing?.data_agendada)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_inicio">Início</Label>
                <Input
                  id="data_inicio"
                  name="data_inicio"
                  type="datetime-local"
                  defaultValue={toDtLocal(editing?.data_inicio)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="data_conclusao">Conclusão</Label>
                <Input
                  id="data_conclusao"
                  name="data_conclusao"
                  type="datetime-local"
                  defaultValue={toDtLocal(editing?.data_conclusao)}
                />
              </div>
            </div>

            {/* Materiais */}
            <div className="space-y-2 border rounded-lg p-3">
              <div className="flex items-center justify-between">
                <Label>Equipamentos / materiais usados</Label>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() =>
                    setMateriais((m) => [
                      ...m,
                      { descricao: "", quantidade: 1, unidade: "un", valor_unitario: 0 },
                    ])
                  }
                >
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
                        <Input
                          placeholder="Descrição"
                          value={m.descricao}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMateriais((arr) =>
                              arr.map((x, j) => (j === i ? { ...x, descricao: v } : x)),
                            );
                          }}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="Qtd"
                          value={m.quantidade}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setMateriais((arr) =>
                              arr.map((x, j) => (j === i ? { ...x, quantidade: v } : x)),
                            );
                          }}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          placeholder="un"
                          value={m.unidade}
                          onChange={(e) => {
                            const v = e.target.value;
                            setMateriais((arr) =>
                              arr.map((x, j) => (j === i ? { ...x, unidade: v } : x)),
                            );
                          }}
                        />
                      </div>
                      <div className="col-span-2">
                        <Input
                          type="number"
                          step="0.01"
                          placeholder="R$ unit."
                          value={m.valor_unitario}
                          onChange={(e) => {
                            const v = Number(e.target.value);
                            setMateriais((arr) =>
                              arr.map((x, j) => (j === i ? { ...x, valor_unitario: v } : x)),
                            );
                          }}
                        />
                      </div>
                      <div className="col-span-1">
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => setMateriais((arr) => arr.filter((_, j) => j !== i))}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  ))}
                  <div className="text-right text-sm text-muted-foreground">
                    Total materiais:{" "}
                    <span className="font-medium text-foreground">R$ {totalMat.toFixed(2)}</span>
                  </div>
                </div>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="assinatura_cliente">Assinatura / nome do recebedor</Label>
              <Input
                id="assinatura_cliente"
                name="assinatura_cliente"
                defaultValue={editing?.assinatura_cliente ?? ""}
                placeholder="Nome de quem assinou no local"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="observacoes_cliente">Observações do cliente</Label>
                <Textarea
                  id="observacoes_cliente"
                  name="observacoes_cliente"
                  defaultValue={editing?.observacoes_cliente ?? ""}
                  rows={2}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="observacoes_internas">Observações internas</Label>
                <Textarea
                  id="observacoes_internas"
                  name="observacoes_internas"
                  defaultValue={editing?.observacoes_internas ?? ""}
                  rows={2}
                />
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
