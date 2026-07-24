import {
    Save,
    FolderOpen,
    Download,
    ZoomIn,
    ZoomOut,
    Maximize,
    Undo2,
    Redo2,
} from "lucide-react";

import { Button } from "@/components/ui/button";

export default function Toolbar() {
    return (
        <div className="h-14 border-b bg-background flex items-center justify-between px-4">

            <div className="flex items-center gap-2">

                <Button variant="default" size="sm">
                    <Save className="h-4 w-4 mr-2" />
                    Salvar
                </Button>

                <Button variant="outline" size="sm">
                    <FolderOpen className="h-4 w-4 mr-2" />
                    Abrir
                </Button>

                <Button variant="outline" size="sm">
                    <Download className="h-4 w-4 mr-2" />
                    Exportar
                </Button>

            </div>

            <div className="flex items-center gap-2">

                <Button variant="ghost" size="icon">
                    <Undo2 className="h-4 w-4" />
                </Button>

                <Button variant="ghost" size="icon">
                    <Redo2 className="h-4 w-4" />
                </Button>

                <Button variant="ghost" size="icon">
                    <ZoomOut className="h-4 w-4" />
                </Button>

                <Button variant="ghost" size="icon">
                    <ZoomIn className="h-4 w-4" />
                </Button>

                <Button variant="ghost" size="icon">
                    <Maximize className="h-4 w-4" />
                </Button>

            </div>

        </div>
    );
}