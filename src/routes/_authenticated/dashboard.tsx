import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { Users, CheckCircle2, Ban, XCircle, Package } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Dashboard — ISP Manager" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { data } = useQuery({
    queryKey: ["dashboard-stats"],
    queryFn: async () => {
      const [ativos, bloqueados, cancelados, planos] = await Promise.all([
        supabase.from("clientes").select("*", { count: "exact", head: true }).eq("status", "ativo"),
        supabase
          .from("clientes")
          .select("*", { count: "exact", head: true })
          .eq("status", "bloqueado"),
        supabase
          .from("clientes")
          .select("*", { count: "exact", head: true })
          .eq("status", "cancelado"),
        supabase.from("planos").select("*", { count: "exact", head: true }).eq("ativo", true),
      ]);
      return {
        ativos: ativos.count ?? 0,
        bloqueados: bloqueados.count ?? 0,
        cancelados: cancelados.count ?? 0,
        planos: planos.count ?? 0,
      };
    },
  });

  const stats = [
    {
      label: "Clientes ativos",
      value: data?.ativos ?? 0,
      icon: CheckCircle2,
      color: "text-emerald-600",
      to: "/clientes",
    },
    {
      label: "Bloqueados",
      value: data?.bloqueados ?? 0,
      icon: Ban,
      color: "text-amber-600",
      to: "/clientes",
    },
    {
      label: "Cancelados",
      value: data?.cancelados ?? 0,
      icon: XCircle,
      color: "text-rose-600",
      to: "/clientes",
    },
    {
      label: "Planos ativos",
      value: data?.planos ?? 0,
      icon: Package,
      color: "text-primary",
      to: "/planos",
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Visão geral do seu provedor</p>
      </div>

      <div className="grid gap-4 grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Link key={s.label} to={s.to}>
              <Card className="hover:shadow-md transition-shadow">
                <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                  <CardTitle className="text-sm font-medium text-muted-foreground">
                    {s.label}
                  </CardTitle>
                  <Icon className={"h-4 w-4 " + s.color} />
                </CardHeader>
                <CardContent>
                  <div className="text-3xl font-bold">{s.value}</div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Users className="h-5 w-5" /> Próximos passos
          </CardTitle>
        </CardHeader>
        <CardContent className="text-sm text-muted-foreground space-y-2">
          <p>
            1. Cadastre seus{" "}
            <Link to="/planos" className="text-primary underline">
              planos de internet
            </Link>
            .
          </p>
          <p>
            2. Comece a cadastrar{" "}
            <Link to="/clientes" className="text-primary underline">
              clientes
            </Link>{" "}
            com PPPoE.
          </p>
          <p>3. Gerencie ativações, bloqueios e cancelamentos direto do painel.</p>
        </CardContent>
      </Card>
    </div>
  );
}
