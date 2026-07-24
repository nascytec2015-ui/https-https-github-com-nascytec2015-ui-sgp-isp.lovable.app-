import {
    Cpu,
    Box,
    Split,
    Network,
    Router,
    User,
} from "lucide-react";

const equipamentos = [
    {
        tipo: "olt",
        nome: "OLT",
        icon: Cpu,
    },
    {
        tipo: "dio",
        nome: "DIO",
        icon: Box,
    },
    {
        tipo: "ceo",
        nome: "CEO",
        icon: Network,
    },
    {
        tipo: "splitter",
        nome: "Splitter",
        icon: Split,
    },
    {
        tipo: "cto",
        nome: "CTO",
        icon: Router,
    },
    {
        tipo: "cliente",
        nome: "Cliente",
        icon: User,
    },
];

export default function Sidebar() {
    return (
        <aside className="w-64 border-r bg-background overflow-y-auto">

            <div className="p-4 border-b">
                <h2 className="font-semibold">
                    Equipamentos
                </h2>

                <p className="text-sm text-muted-foreground">
                    Arraste um equipamento para o diagrama.
                </p>
            </div>

            <div className="p-3 space-y-2">

                {equipamentos.map((item) => {
                    const Icon = item.icon;

                    return (
                        <div
                            key={item.tipo}
                            draggable
                            className="
                flex
                items-center
                gap-3
                p-3
                rounded-lg
                border
                cursor-grab
                hover:bg-accent
                transition
              "
                            onDragStart={(event) => {
                                event.dataTransfer.setData(
                                    "application/reactflow",
                                    item.tipo
                                );
                                event.dataTransfer.effectAllowed = "move";
                            }}
                        >
                            <Icon className="w-5 h-5" />

                            <span>{item.nome}</span>
                        </div>
                    );
                })}

            </div>

        </aside>
    );
}