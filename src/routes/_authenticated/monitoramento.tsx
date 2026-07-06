import { createFileRoute } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import {
  Activity,
  AlertTriangle,
  CheckCircle2,
  Gauge,
  RadioTower,
  RefreshCw,
  Router,
  Server,
  ShieldAlert,
  Wifi,
  Zap,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/monitoramento")({
  head: () => ({ meta: [{ title: "Monitoramento - ISP Manager" }] }),
  component: MonitoramentoPage,
});

type DeviceStatus = "online" | "degraded" | "offline";
type DeviceKind = "router" | "radio" | "server" | "power";

type Device = {
  id: string;
  name: string;
  role: string;
  ip: string;
  kind: DeviceKind;
  status: DeviceStatus;
  latencyMs: number;
  lossPct: number;
  uptimePct: number;
  cpuPct: number;
  trafficPct: number;
  throughputMbps: number;
  x: number;
  y: number;
};

type Link = {
  from: string;
  to: string;
  label: string;
  capacityGbps: number;
};

const INITIAL_DEVICES: Device[] = [
  {
    id: "internet",
    name: "Upstream IP",
    role: "Transito principal",
    ip: "200.160.0.1",
    kind: "router",
    status: "online",
    latencyMs: 7.8,
    lossPct: 0.04,
    uptimePct: 99.99,
    cpuPct: 18,
    trafficPct: 68,
    throughputMbps: 682,
    x: 95,
    y: 82,
  },
  {
    id: "edge",
    name: "RTR-BORDA-01",
    role: "Borda / BGP",
    ip: "10.0.0.1",
    kind: "router",
    status: "online",
    latencyMs: 2.4,
    lossPct: 0.01,
    uptimePct: 99.98,
    cpuPct: 36,
    trafficPct: 61,
    throughputMbps: 611,
    x: 280,
    y: 82,
  },
  {
    id: "core",
    name: "CORE-01",
    role: "Roteador core",
    ip: "10.0.1.1",
    kind: "router",
    status: "online",
    latencyMs: 1.2,
    lossPct: 0,
    uptimePct: 100,
    cpuPct: 41,
    trafficPct: 57,
    throughputMbps: 574,
    x: 450,
    y: 220,
  },
  {
    id: "olt",
    name: "OLT-CENTRO",
    role: "Agregacao FTTH",
    ip: "10.10.0.2",
    kind: "radio",
    status: "online",
    latencyMs: 3.7,
    lossPct: 0.03,
    uptimePct: 99.96,
    cpuPct: 52,
    trafficPct: 72,
    throughputMbps: 728,
    x: 690,
    y: 90,
  },
  {
    id: "dist",
    name: "SW-DIST-01",
    role: "Distribuicao",
    ip: "10.20.0.2",
    kind: "router",
    status: "degraded",
    latencyMs: 12.6,
    lossPct: 0.48,
    uptimePct: 99.72,
    cpuPct: 64,
    trafficPct: 86,
    throughputMbps: 861,
    x: 690,
    y: 220,
  },
  {
    id: "radius",
    name: "SRV-RADIUS",
    role: "Autenticacao PPPoE",
    ip: "10.30.0.10",
    kind: "server",
    status: "online",
    latencyMs: 1.8,
    lossPct: 0,
    uptimePct: 99.99,
    cpuPct: 29,
    trafficPct: 24,
    throughputMbps: 46,
    x: 690,
    y: 350,
  },
  {
    id: "backup",
    name: "LINK-BACKUP",
    role: "Backup LTE",
    ip: "172.16.0.1",
    kind: "radio",
    status: "offline",
    latencyMs: 0,
    lossPct: 100,
    uptimePct: 97.8,
    cpuPct: 0,
    trafficPct: 0,
    throughputMbps: 0,
    x: 280,
    y: 350,
  },
  {
    id: "energia",
    name: "NOBREAK-CORE",
    role: "Energia core",
    ip: "10.0.2.20",
    kind: "power",
    status: "online",
    latencyMs: 2.1,
    lossPct: 0,
    uptimePct: 100,
    cpuPct: 17,
    trafficPct: 12,
    throughputMbps: 8,
    x: 450,
    y: 350,
  },
];

const LINKS: Link[] = [
  { from: "internet", to: "edge", label: "1G transito", capacityGbps: 1 },
  { from: "edge", to: "core", label: "10G core", capacityGbps: 10 },
  { from: "backup", to: "core", label: "backup", capacityGbps: 0.2 },
  { from: "core", to: "olt", label: "FTTH", capacityGbps: 10 },
  { from: "core", to: "dist", label: "POP bairros", capacityGbps: 10 },
  { from: "core", to: "radius", label: "AAA", capacityGbps: 1 },
  { from: "energia", to: "core", label: "energia", capacityGbps: 0 },
];

const STATUS_META: Record<
  DeviceStatus,
  { label: string; badge: string; dot: string; stroke: string; text: string }
> = {
  online: {
    label: "Online",
    badge: "border-emerald-500/30 bg-emerald-500/10 text-emerald-300",
    dot: "bg-emerald-400",
    stroke: "hsl(151 80% 48%)",
    text: "text-emerald-300",
  },
  degraded: {
    label: "Atencao",
    badge: "border-amber-500/30 bg-amber-500/10 text-amber-300",
    dot: "bg-amber-400",
    stroke: "hsl(43 95% 56%)",
    text: "text-amber-300",
  },
  offline: {
    label: "Offline",
    badge: "border-rose-500/30 bg-rose-500/10 text-rose-300",
    dot: "bg-rose-400",
    stroke: "hsl(0 84% 60%)",
    text: "text-rose-300",
  },
};

const ALERTS = [
  {
    title: "Link de backup indisponivel",
    target: "LINK-BACKUP",
    severity: "critical",
    time: "ha 12 min",
  },
  {
    title: "Utilizacao alta no POP bairros",
    target: "SW-DIST-01",
    severity: "warning",
    time: "ha 4 min",
  },
  {
    title: "BGP principal estavel",
    target: "RTR-BORDA-01",
    severity: "info",
    time: "agora",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function jitter(value: number, amount: number, min: number, max: number, digits = 1) {
  return Number(clamp(value + (Math.random() - 0.5) * amount, min, max).toFixed(digits));
}

function updateTelemetry(devices: Device[]) {
  return devices.map((device) => {
    if (device.status === "offline") return device;

    const latencyMs = jitter(device.latencyMs, 3, 0.4, 35);
    const lossPct = jitter(device.lossPct, 0.18, 0, 2.8, 2);
    const trafficPct = jitter(device.trafficPct, 8, 8, 96);
    const cpuPct = jitter(device.cpuPct, 6, 5, 92);
    const throughputMbps = Math.round((trafficPct / 100) * 1000);
    const status: DeviceStatus =
      lossPct > 0.7 || latencyMs > 18 || trafficPct > 88 ? "degraded" : "online";

    return {
      ...device,
      status,
      latencyMs,
      lossPct,
      trafficPct,
      cpuPct,
      throughputMbps,
    };
  });
}

function deviceIcon(kind: DeviceKind) {
  if (kind === "server") return Server;
  if (kind === "radio") return RadioTower;
  if (kind === "power") return Zap;
  return Router;
}

function MonitoramentoPage() {
  const [devices, setDevices] = useState<Device[]>(INITIAL_DEVICES);
  const [lastUpdate, setLastUpdate] = useState(() => new Date());

  useEffect(() => {
    const timer = window.setInterval(() => {
      setDevices((current) => updateTelemetry(current));
      setLastUpdate(new Date());
    }, 4500);

    return () => window.clearInterval(timer);
  }, []);

  const summary = useMemo(() => {
    const activeDevices = devices.filter((device) => device.status !== "offline");
    const averageLatency =
      activeDevices.reduce((sum, device) => sum + device.latencyMs, 0) /
      Math.max(1, activeDevices.length);
    const averageLoss =
      activeDevices.reduce((sum, device) => sum + device.lossPct, 0) /
      Math.max(1, activeDevices.length);
    const averageTraffic =
      devices.reduce((sum, device) => sum + device.trafficPct, 0) / Math.max(1, devices.length);

    return {
      online: devices.filter((device) => device.status === "online").length,
      degraded: devices.filter((device) => device.status === "degraded").length,
      offline: devices.filter((device) => device.status === "offline").length,
      averageLatency,
      averageLoss,
      averageTraffic,
    };
  }, [devices]);

  function refresh() {
    setDevices((current) => updateTelemetry(current));
    setLastUpdate(new Date());
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Monitoramento</h1>
          <p className="text-muted-foreground">Rede principal e backbone</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge className="border-emerald-500/30 bg-emerald-500/10 text-emerald-300">
            <span className="mr-2 h-2 w-2 rounded-full bg-emerald-400" />
            Ao vivo
          </Badge>
          <Button variant="outline" size="sm" onClick={refresh}>
            <RefreshCw className="mr-2 h-4 w-4" />
            Atualizar
          </Button>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          title="Equipamentos online"
          value={`${summary.online}/${devices.length}`}
          detail={`${summary.degraded} em atencao, ${summary.offline} offline`}
          icon={CheckCircle2}
          tone="emerald"
        />
        <MetricCard
          title="Latencia media"
          value={`${summary.averageLatency.toFixed(1)} ms`}
          detail="Backbone e agregacao"
          icon={Activity}
          tone="sky"
        />
        <MetricCard
          title="Perda media"
          value={`${summary.averageLoss.toFixed(2)}%`}
          detail="Amostra dos ativos"
          icon={ShieldAlert}
          tone={summary.averageLoss > 0.5 ? "amber" : "emerald"}
        />
        <MetricCard
          title="Utilizacao media"
          value={`${summary.averageTraffic.toFixed(0)}%`}
          detail={lastUpdate.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}
          icon={Gauge}
          tone={summary.averageTraffic > 80 ? "amber" : "sky"}
        />
      </div>

      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <Card className="overflow-hidden border-slate-700/80 bg-slate-950/80">
          <CardHeader className="border-b border-slate-800">
            <CardTitle className="flex items-center gap-2 text-base">
              <Wifi className="h-5 w-5 text-cyan-300" />
              Topologia principal
            </CardTitle>
          </CardHeader>
          <CardContent className="p-0">
            <NetworkMap devices={devices} />
          </CardContent>
        </Card>

        <Card className="border-border/80">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <AlertTriangle className="h-5 w-5 text-amber-300" />
              Alertas
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {ALERTS.map((alert) => (
              <div
                key={`${alert.title}-${alert.target}`}
                className="rounded-md border bg-muted/30 p-3"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="font-medium">{alert.title}</div>
                    <div className="mt-1 text-xs text-muted-foreground">{alert.target}</div>
                  </div>
                  <Badge
                    className={cn(
                      "shrink-0",
                      alert.severity === "critical" &&
                        "border-rose-500/30 bg-rose-500/10 text-rose-300",
                      alert.severity === "warning" &&
                        "border-amber-500/30 bg-amber-500/10 text-amber-300",
                      alert.severity === "info" &&
                        "border-cyan-500/30 bg-cyan-500/10 text-cyan-300",
                    )}
                  >
                    {alert.time}
                  </Badge>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Equipamentos críticos</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome</TableHead>
                <TableHead>IP</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Latência</TableHead>
                <TableHead>Perda</TableHead>
                <TableHead>Tráfego</TableHead>
                <TableHead>CPU</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {devices.map((device) => (
                <TableRow key={device.id}>
                  <TableCell>
                    <div className="font-medium">{device.name}</div>
                    <div className="text-xs text-muted-foreground">{device.role}</div>
                  </TableCell>
                  <TableCell className="font-mono text-xs">{device.ip}</TableCell>
                  <TableCell>
                    <Badge className={STATUS_META[device.status].badge}>
                      {STATUS_META[device.status].label}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    {device.status === "offline" ? "-" : `${device.latencyMs} ms`}
                  </TableCell>
                  <TableCell>
                    {device.status === "offline" ? "100%" : `${device.lossPct}%`}
                  </TableCell>
                  <TableCell>
                    <MiniBar value={device.trafficPct} status={device.status} />
                  </TableCell>
                  <TableCell>
                    <MiniBar value={device.cpuPct} status={device.status} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function MetricCard({
  title,
  value,
  detail,
  icon: Icon,
  tone,
}: {
  title: string;
  value: string;
  detail: string;
  icon: typeof Activity;
  tone: "emerald" | "sky" | "amber";
}) {
  const toneClass = {
    emerald: "text-emerald-300 bg-emerald-500/10 border-emerald-500/20",
    sky: "text-sky-300 bg-sky-500/10 border-sky-500/20",
    amber: "text-amber-300 bg-amber-500/10 border-amber-500/20",
  }[tone];

  return (
    <Card className="border-border/80">
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
        <div className={cn("rounded-md border p-2", toneClass)}>
          <Icon className="h-4 w-4" />
        </div>
      </CardHeader>
      <CardContent>
        <div className="text-3xl font-bold">{value}</div>
        <div className="mt-1 text-xs text-muted-foreground">{detail}</div>
      </CardContent>
    </Card>
  );
}

function NetworkMap({ devices }: { devices: Device[] }) {
  const byId = new Map(devices.map((device) => [device.id, device]));

  return (
    <div className="relative overflow-hidden">
      <svg viewBox="0 0 820 430" className="h-[480px] w-full min-w-[720px] bg-slate-950">
        <defs>
          <pattern id="monitor-grid" width="32" height="32" patternUnits="userSpaceOnUse">
            <path d="M 32 0 L 0 0 0 32" fill="none" stroke="hsl(215 28% 22%)" strokeWidth="0.5" />
          </pattern>
          <filter id="node-glow" x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="6" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        <rect width="820" height="430" fill="hsl(222 47% 7%)" />
        <rect width="820" height="430" fill="url(#monitor-grid)" opacity="0.8" />

        {LINKS.map((link) => {
          const from = byId.get(link.from);
          const to = byId.get(link.to);
          if (!from || !to) return null;
          const status =
            from.status === "offline" || to.status === "offline"
              ? "offline"
              : from.status === "degraded" || to.status === "degraded"
                ? "degraded"
                : "online";

          return (
            <g key={`${link.from}-${link.to}`}>
              <line
                x1={from.x}
                y1={from.y}
                x2={to.x}
                y2={to.y}
                stroke={STATUS_META[status].stroke}
                strokeWidth={status === "offline" ? 2 : 3}
                strokeDasharray={status === "offline" ? "8 8" : undefined}
                opacity={status === "offline" ? 0.45 : 0.85}
              />
              <text
                x={(from.x + to.x) / 2}
                y={(from.y + to.y) / 2 - 8}
                textAnchor="middle"
                fill="hsl(215 20% 72%)"
                fontSize="11"
              >
                {link.label}
              </text>
            </g>
          );
        })}

        {devices.map((device) => {
          const meta = STATUS_META[device.status];
          const Icon = deviceIcon(device.kind);

          return (
            <g key={device.id} transform={`translate(${device.x}, ${device.y})`}>
              <circle r="31" fill={meta.stroke} opacity="0.16" filter="url(#node-glow)" />
              <circle r="27" fill="hsl(222 47% 10%)" stroke={meta.stroke} strokeWidth="2.5" />
              <foreignObject x="-14" y="-14" width="28" height="28">
                <div className={cn("flex h-7 w-7 items-center justify-center", meta.text)}>
                  <Icon className="h-5 w-5" />
                </div>
              </foreignObject>
              <text
                y="48"
                textAnchor="middle"
                fill="hsl(210 40% 96%)"
                fontSize="12"
                fontWeight="700"
              >
                {device.name}
              </text>
              <text y="64" textAnchor="middle" fill="hsl(215 20% 65%)" fontSize="10">
                {device.status === "offline"
                  ? "sem resposta"
                  : `${device.latencyMs} ms · ${device.trafficPct.toFixed(0)}%`}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}

function MiniBar({ value, status }: { value: number; status: DeviceStatus }) {
  return (
    <div className="flex min-w-[120px] items-center gap-2">
      <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
        <div
          className={cn(
            "h-full rounded-full transition-all",
            status === "offline" && "bg-rose-400",
            status === "degraded" && "bg-amber-400",
            status === "online" && "bg-emerald-400",
          )}
          style={{ width: `${clamp(value, 0, 100)}%` }}
        />
      </div>
      <span className="w-9 text-right text-xs text-muted-foreground">{value.toFixed(0)}%</span>
    </div>
  );
}
