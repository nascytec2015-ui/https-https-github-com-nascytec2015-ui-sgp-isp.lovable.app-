import { useCallback } from "react";
import ReactFlow, {
    Background,
    Controls,
    MiniMap,
    useNodesState,
    useEdgesState,
    addEdge,
    Connection,
    Edge,
    Node,
} from "reactflow";

import "reactflow/dist/style.css";

const initialNodes: Node[] = [];

const initialEdges: Edge[] = [];

export default function Canvas() {
    const [nodes, setNodes, onNodesChange] =
        useNodesState(initialNodes);

    const [edges, setEdges, onEdgesChange] =
        useEdgesState(initialEdges);

    const onConnect = useCallback(
        (params: Connection) =>
            setEdges((eds) => addEdge(params, eds)),
        [setEdges]
    );

    const onDragOver = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();
            event.dataTransfer.dropEffect = "move";
        },
        []
    );

    const onDrop = useCallback(
        (event: React.DragEvent) => {
            event.preventDefault();

            const tipo =
                event.dataTransfer.getData(
                    "application/reactflow"
                );

            if (!tipo) return;

            const rect =
                (
                    event.target as HTMLDivElement
                ).getBoundingClientRect();

            const novoNode: Node = {
                id: crypto.randomUUID(),

                type: "default",

                position: {
                    x: event.clientX - rect.left,
                    y: event.clientY - rect.top,
                },

                data: {
                    label: tipo.toUpperCase(),
                },
            };

            setNodes((nds) => [...nds, novoNode]);
        },
        [setNodes]
    );

    return (
        <div className="w-full h-full">

            <ReactFlow
                nodes={nodes}
                edges={edges}
                fitView
                onNodesChange={onNodesChange}
                onEdgesChange={onEdgesChange}
                onConnect={onConnect}
                onDrop={onDrop}
                onDragOver={onDragOver}
            >
                <Background />

                <MiniMap />

                <Controls />
            </ReactFlow>

        </div>
    );
}