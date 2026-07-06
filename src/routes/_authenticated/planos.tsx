import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { Plus, Pencil, Trash2, Package } from "lucide-react";
import { z } from "zod";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { Switch } from "@/components/ui/switch";

export const Route = createFileRoute("/_authenticated/planos")({
  head: () => ({ meta: [{ title: "Planos — ISP Manager" }] }),
  component: PlanosPage,
});

type Plano = {
  id: string;
  nome: string;
  velocidade_down: number;
  velocidade_up: number;
  valor: number;
  ativo: boolean;
};

const planoSchema = z.object({
  nome: z.string().trim().min(2, "Nome obrigatório").max(80),
  velocidade_down: z.coerce.number().int().min(0).max(100000),
  velocidade_up: z.coerce.number().int().min(0).max(100000),
  valor: z.coerce.number().min(0).max(99999),
  ativo: z.boolean(),
});

function PlanosPage() {
  const qc = useQueryClient();
  const { isAdmin } = useAuth();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Plano | null>(null);

  const { data: planos = [], isLoading } = useQuery({
    queryKey: ["planos"],
    queryFn: async () => {
      const { data, error } = await supabase.from("planos").select("*").order("nome");
      if (error) throw error;
      return data as Plano[];
    },
  });

  const save = useMutation({
    mutationFn: async (form: FormData) => {
      const parsed = planoSchema.parse({
        nome: form.get("nome"),
        velocidade_down: form.get("velocidade_down"),
        velocidade_up: form.get("velocidade_up"),
        valor: form.get("valor"),
        ativo: form.get("ativo") === "on",
      });
      if (editing) {
        const { error } = await supabase.from("planos").update(parsed).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("planos").insert(parsed);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(editing ? "Plano atualizado" : "Plano criado");
      qc.invalidateQueries({ queryKey: ["planos"] });
      setOpen(false);
      setEditing(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("planos").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Plano removido");
      qc.invalidateQueries({ queryKey: ["planos"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Planos</h1>
          <p className="text-muted-foreground">Gerencie os planos de internet ofertados</p>
        </div>
        <Dialog
          open={open}
          onOpenChange={(o) => {
            setOpen(o);
            if (!o) setEditing(null);
          }}
        >
          <DialogTrigger asChild>
            <Button>
              <Plus className="h-4 w-4 mr-2" /> Novo plano
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{editing ? "Editar plano" : "Novo plano"}</DialogTitle>
            </DialogHeader>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                save.mutate(new FormData(e.currentTarget));
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="nome">Nome</Label>
                <Input id="nome" name="nome" defaultValue={editing?.nome} required />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label htmlFor="velocidade_down">Download (Mbps)</Label>
                  <Input
                    id="velocidade_down"
                    name="velocidade_down"
                    type="number"
                    min="0"
                    defaultValue={editing?.velocidade_down ?? 0}
                    required
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="velocidade_up">Upload (Mbps)</Label>
                  <Input
                    id="velocidade_up"
                    name="velocidade_up"
                    type="number"
                    min="0"
                    defaultValue={editing?.velocidade_up ?? 0}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="valor">Valor mensal (R$)</Label>
                <Input
                  id="valor"
                  name="valor"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={editing?.valor ?? 0}
                  required
                />
              </div>
              <div className="flex items-center gap-3">
                <Switch id="ativo" name="ativo" defaultChecked={editing?.ativo ?? true} />
                <Label htmlFor="ativo">Plano ativo</Label>
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

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="p-8 text-center text-muted-foreground">Carregando...</div>
          ) : planos.length === 0 ? (
            <div className="p-12 text-center text-muted-foreground">
              <Package className="h-10 w-10 mx-auto mb-2 opacity-50" />
              Nenhum plano cadastrado ainda
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>Velocidade</TableHead>
                  <TableHead>Valor</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="text-right">Ações</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {planos.map((p) => (
                  <TableRow key={p.id}>
                    <TableCell className="font-medium">{p.nome}</TableCell>
                    <TableCell>
                      {p.velocidade_down}/{p.velocidade_up} Mbps
                    </TableCell>
                    <TableCell>R$ {Number(p.valor).toFixed(2)}</TableCell>
                    <TableCell>
                      {p.ativo ? <Badge>Ativo</Badge> : <Badge variant="secondary">Inativo</Badge>}
                    </TableCell>
                    <TableCell className="text-right space-x-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setEditing(p);
                          setOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      {isAdmin && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            if (confirm(`Remover plano "${p.nome}"?`)) remove.mutate(p.id);
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
    </div>
  );
}
