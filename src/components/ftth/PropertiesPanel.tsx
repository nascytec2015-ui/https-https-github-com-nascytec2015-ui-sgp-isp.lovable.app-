export default function PropertiesPanel() {
    return (
        <aside className="w-72 border-l bg-background">
            <div className="p-4 border-b">
                <h2 className="font-semibold">
                    Propriedades
                </h2>

                <p className="text-sm text-muted-foreground">
                    Selecione um equipamento para editar suas propriedades.
                </p>
            </div>

            <div className="p-4 text-sm text-muted-foreground">
                Nenhum equipamento selecionado.
            </div>
        </aside>
    );
}