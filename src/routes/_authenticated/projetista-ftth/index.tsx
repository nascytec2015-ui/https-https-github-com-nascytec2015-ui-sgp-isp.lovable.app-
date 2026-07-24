import { createFileRoute } from "@tanstack/react-router";
import { Card, CardContent } from "@/components/ui/card";

import Toolbar from "@/components/ftth/Toolbar";
import Sidebar from "@/components/ftth/Sidebar";
import Canvas from "@/components/ftth/Canvas";
import PropertiesPanel from "@/components/ftth/PropertiesPanel";

export const Route = createFileRoute(
  "/_authenticated/projetista-ftth/"
)({
  component: ProjetistaFTTHPage,
});

function ProjetistaFTTHPage() {
  return (
    <div className="flex flex-col h-[calc(100vh-70px)]">

      <Toolbar />

      <div className="flex flex-1 overflow-hidden">

        <Sidebar />

        <Card className="flex-1 rounded-none border-l border-r">
          <CardContent className="p-0 h-full">
            <Canvas />
          </CardContent>
        </Card>

        <PropertiesPanel />

      </div>

    </div>
  );
}