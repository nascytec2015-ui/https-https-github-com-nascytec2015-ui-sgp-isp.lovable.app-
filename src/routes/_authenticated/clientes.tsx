import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { z } from "zod";
import {
  Plus,
  Search,
  MoreVertical,
  Ban,
  CheckCircle2,
  XCircle,
  Trash2,
  Pencil,
  Users,
  Eye,
  EyeOff,
} from "lucide-react";
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
  DialogDescription,
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export const Route = createFileRoute("/_authenticated/clientes")({
  head: () => ({ meta: [{ title: "Clientes — ISP Manager" }] }),
  component: ClientesPage,
});

type Status = "ativo" | "bloqueado" | "cancelado";
type Cliente = {
  id: string;
  nome: string;
  cpf_cnpj: string | null;
  email: string | null;
  telefone: string | null;
  endereco: string | null;
  numero: string | null;
  bairro: string | null;
  cidade: string | null;
  estado: string | null;
  cep: string | null;
  plano_id: string | null;
  ppoe_user: string | null;
  ppoe_pass: string | null;
  ip_fixo: string | null;
  observacoes: string | null;
  status: Status;
  data_ativacao: string | null;
  data_cancelamento: string | null;
};
type Plano = { id: string; nome: string };

const clienteSchema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório").max(120),
  cpf_cnpj: z.string().trim().max(20).optional().or(z.literal("")),
  email: z.union([z.string().trim().email("E-mail inválido").max(255), z.literal("")]).optional(),
  telefone: z.string().trim().max(30).optional().or(z.literal("")),
  endereco: z.string().trim().max(200).optional().or(z.literal("")),
  numero: z.string().trim().max(20).optional().or(z.literal("")),
  bairro: z.string().trim().max(80).optional().or(z.literal("")),
  cidade: z.string().trim().max(80).optional().or(z.literal("")),
  estado: z.string().trim().max(2).optional().or(z.literal("")),
  cep: z.string().trim().max(10).optional().or(z.literal("")),
  plano_id: z.string().uuid().optional().or(z.literal("")),
  ppoe_user: z.string().trim().max(80).optional().or(z.literal("")),
  ppoe_pass: z.string().trim().max(80).optional().or(z.literal("")),
  ip_fixo: z.string().trim().max(45).optional().or(z.literal("")),
  observacoes: z.string().trim().max(1000).optional().or(z.literal("")),
});

function gerarSenha(len = 8) {
  const chars = "abcdefghjkmnpqrstuvwxyz23456789";
  let s = "";
  for (let i = 0; i < len; i++) s += chars[Math.floor(Math.random() * chars.length)];
  return s;
}

const STATUS_META: Record<Status, { label: string; className: string }> = {
  ativo: { label: "Ativo", className: "bg-emerald-100 text-emerald-700 hover:bg-emerald-100" },
  bloqueado: { label: "Bloqueado", className: "bg-amber-100 text-amber-700 hover:bg-amber-100" },
  cancelado: { label: "Cancelado", className: "bg-rose-100 text-rose-700 hover:bg-rose-100" },
};

function ClientesPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<"todos" | Status>("todos");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Cliente | null>(null);
  const [showPass, setShowPass] = useState(false);

  const { data: planos = [] } = useQuery({
    queryKey: ["planos-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("planos")
        .select("id,nome")
        .eq("ativo", true)
        .order("nome");
      if (error) throw error;
      return data as Plano[];
    },
  });
  const planoNome = useMemo(() => Object.fromEntries(planos.map((p) => [p.id, p.nome])), [planos]);

  const { data: clientes = [], isLoading } = useQuery({
    queryKey: ["clientes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clientes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as Cliente[];
    },
  });

  const filtered = clientes.filter((c) => {
    if (statusFilter !== "todos" && c.status !== statusFilter) return false;
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      c.nome.toLowerCase().includes(q) ||
      (c.cpf_cnpj ?? "").toLowerCase().includes(q) ||
      (c.ppoe_user ?? "").toLowerCase().includes(q) ||
      (c.email ?? "").toLowerCase().includes(q)
    );
  });

  const save = useMutation({
    mutationFn: async (fd: FormData) => {
      const raw = Object.fromEntries(fd.entries()) as Record<string, string>;
      const parsed = clienteSchema.parse(raw);
      const payload: Record<string, unknown> = {};
      Object.entries(parsed).forEach(([k, v]) => {
        payload[k] = v === "" || v === undefined ? null : v;
      });
      if (editing) {
        const { error } = await supabase
          .from("clientes")
          .update(payload as never)
          .eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("clientes").insert(payload as never);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Cliente atualizado" : "Cliente cadastrado");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const changeStatus = useMutation({
    mutationFn: async ({ id, status }: { id: string; status: Status }) => {
      const update: Record<string, unknown> = { status };
      if (status === "cancelado") update.data_cancelamento = new Date().toISOString().slice(0, 10);
      const { error } = await supabase
        .from("clientes")
        .update(update as never)
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      toast.success(`Cliente ${STATUS_META[vars.status].label.toLowerCase()}`);
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clientes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Cliente excluído");
      qc.invalidateQueries({ queryKey: ["clientes"] });
      qc.invalidateQueries({ queryKey: ["dashboard-stats"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openNew() {
    setEditing(null);
    setShowPass(false);
    setOpen(true);
  }
  function openEdit(c: Cliente) {
    setEditing(c);
    setShowPass(false);
    setOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Clientes</h1>
          <p className="text-muted-foreground">Gerencie cadastros, PPPoE e status</p>
        </div>
        <Button onClick={openNew}>
          <Plus className="h-4 w-4 mr-2" /> Novo cliente
        </Button>
      </div>

      <Card>
        <CardContent className="p-4 flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[200px]">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Buscar por nome, CPF/CNPJ, PPPoE, e-mail..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="pl-9"
            />
          </div>
          <Select
            value={statusFilter}
            onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}
          >
            <SelectTrigger className="w-[180px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="todos">Todos os status</SelectItem>
              <SelectItem value="ativo">Ativos</SelectItem>
              <SelectItem value="bloqueado">Bloqueados</SelectItem>
              <SelectItem value="cancelado">Cancelados</SelectItem>
            </SelectContent>
          </Select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : filtered.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Users className="h-10 w-10 mx-auto mb-2 opacity-50" />
              {clientes.length === 0 ? "Nenhum cliente cadastrado" : "Nenhum resultado"}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead className="hidden md:table-cell">PPPoE</TableHead>
                    <TableHead className="hidden lg:table-cell">Plano</TableHead>
                    <TableHead className="hidden lg:table-cell">Telefone</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Ações</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filtered.map((c) => {
                    const meta = STATUS_META[c.status];
                    return (
                      <TableRow key={c.id}>
                        <TableCell>
                          <div className="font-medium">{c.nome}</div>
                          <div className="text-xs text-muted-foreground">{c.cpf_cnpj || "—"}</div>
                        </TableCell>
                        <TableCell className="hidden md:table-cell font-mono text-xs">
                          {c.ppoe_user || "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">
                          {c.plano_id ? (planoNome[c.plano_id] ?? "—") : "—"}
                        </TableCell>
                        <TableCell className="hidden lg:table-cell">{c.telefone || "—"}</TableCell>
                        <TableCell>
                          <Badge className={meta.className}>{meta.label}</Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="icon">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem onClick={() => openEdit(c)}>
                                <Pencil className="h-4 w-4 mr-2" /> Editar
                              </DropdownMenuItem>
                              <DropdownMenuSeparator />
                              {c.status !== "ativo" && (
                                <DropdownMenuItem
                                  onClick={() => changeStatus.mutate({ id: c.id, status: "ativo" })}
                                >
                                  <CheckCircle2 className="h-4 w-4 mr-2 text-emerald-600" />{" "}
                                  Desbloquear / Ativar
                                </DropdownMenuItem>
                              )}
                              {c.status !== "bloqueado" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    changeStatus.mutate({ id: c.id, status: "bloqueado" })
                                  }
                                >
                                  <Ban className="h-4 w-4 mr-2 text-amber-600" /> Bloquear
                                </DropdownMenuItem>
                              )}
                              {c.status !== "cancelado" && (
                                <DropdownMenuItem
                                  onClick={() =>
                                    changeStatus.mutate({ id: c.id, status: "cancelado" })
                                  }
                                >
                                  <XCircle className="h-4 w-4 mr-2 text-rose-600" /> Cancelar
                                </DropdownMenuItem>
                              )}
                              {isAdmin && (
                                <>
                                  <DropdownMenuSeparator />
                                  <DropdownMenuItem
                                    className="text-destructive"
                                    onClick={() => {
                                      if (
                                        confirm(
                                          `Excluir cliente "${c.nome}"? Esta ação não pode ser desfeita.`,
                                        )
                                      )
                                        remove.mutate(c.id);
                                    }}
                                  >
                                    <Trash2 className="h-4 w-4 mr-2" /> Excluir
                                  </DropdownMenuItem>
                                </>
                              )}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <Dialog
        open={open}
        onOpenChange={(o) => {
          setOpen(o);
          if (!o) setEditing(null);
        }}
      >
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editing ? "Editar cliente" : "Novo cliente"}</DialogTitle>
            <DialogDescription>Preencha os dados do cliente e do PPPoE</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate(new FormData(e.currentTarget));
            }}
            className="space-y-4"
          >
            <div className="grid md:grid-cols-2 gap-3">
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="nome">Nome completo *</Label>
                <Input id="nome" name="nome" defaultValue={editing?.nome ?? ""} required />
              </div>
              <div className="space-y-2">
                <Label htmlFor="cpf_cnpj">CPF / CNPJ</Label>
                <Input id="cpf_cnpj" name="cpf_cnpj" defaultValue={editing?.cpf_cnpj ?? ""} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="telefone">Telefone</Label>
                <Input id="telefone" name="telefone" defaultValue={editing?.telefone ?? ""} />
              </div>
              <div className="space-y-2 md:col-span-2">
                <Label htmlFor="email">E-mail</Label>
                <Input id="email" name="email" type="email" defaultValue={editing?.email ?? ""} />
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Endereço</h3>
              <div className="grid md:grid-cols-6 gap-3">
                <div className="space-y-2 md:col-span-4">
                  <Label htmlFor="endereco">Logradouro</Label>
                  <Input id="endereco" name="endereco" defaultValue={editing?.endereco ?? ""} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="numero">Número</Label>
                  <Input id="numero" name="numero" defaultValue={editing?.numero ?? ""} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="bairro">Bairro</Label>
                  <Input id="bairro" name="bairro" defaultValue={editing?.bairro ?? ""} />
                </div>
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="cidade">Cidade</Label>
                  <Input id="cidade" name="cidade" defaultValue={editing?.cidade ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="estado">UF</Label>
                  <Input
                    id="estado"
                    name="estado"
                    maxLength={2}
                    defaultValue={editing?.estado ?? ""}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="cep">CEP</Label>
                  <Input id="cep" name="cep" defaultValue={editing?.cep ?? ""} />
                </div>
              </div>
            </div>

            <div className="border-t pt-4">
              <h3 className="text-sm font-semibold mb-3">Conexão</h3>
              <div className="grid md:grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="plano_id">Plano</Label>
                  <select
                    id="plano_id"
                    name="plano_id"
                    defaultValue={editing?.plano_id ?? ""}
                    className="w-full h-9 rounded-md border border-input bg-background px-3 text-sm"
                  >
                    <option value="">— Selecione —</option>
                    {planos.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.nome}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ip_fixo">IP fixo (opcional)</Label>
                  <Input id="ip_fixo" name="ip_fixo" defaultValue={editing?.ip_fixo ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ppoe_user">Usuário PPPoE</Label>
                  <Input id="ppoe_user" name="ppoe_user" defaultValue={editing?.ppoe_user ?? ""} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="ppoe_pass">Senha PPPoE</Label>
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Input
                        id="ppoe_pass"
                        name="ppoe_pass"
                        type={showPass ? "text" : "password"}
                        defaultValue={editing?.ppoe_pass ?? ""}
                      />
                      <button
                        type="button"
                        onClick={() => setShowPass((s) => !s)}
                        className="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground"
                      >
                        {showPass ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const input = document.getElementById("ppoe_pass") as HTMLInputElement;
                        input.value = gerarSenha(10);
                      }}
                    >
                      Gerar
                    </Button>
                  </div>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="observacoes">Observações</Label>
              <Textarea
                id="observacoes"
                name="observacoes"
                rows={3}
                defaultValue={editing?.observacoes ?? ""}
              />
            </div>

            <DialogFooter>
              <Button type="submit" disabled={save.isPending}>
                {save.isPending ? "Salvando..." : "Salvar"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
