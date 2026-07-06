import { useState, useRef } from 'react';
import { Upload, X, Loader2, File, Image as ImageIcon, Video } from 'lucide-react';
import { Button } from './button';
import { Card } from './card';
import { useToast } from '@/hooks/use-toast';

interface OsEvidencia {
    id?: string;
    url: string;
    tipo: 'foto' | 'video' | 'documento';
    descricao: string;
    tamanho_bytes?: number;
    mime_type?: string;
    created_at?: string;
}

interface EvidenciasOsProps {
    osId: string;
    evidencias: OsEvidencia[];
    onUpload: (file: File, tipo: string, descricao: string) => Promise<void>;
    onDelete?: (evidenciaId: string) => Promise<void>;
    readOnly?: boolean;
}

export function EvidenciasOs({
    osId,
    evidencias = [],
    onUpload,
    onDelete,
    readOnly = false
}: EvidenciasOsProps) {
    const [uploading, setUploading] = useState(false);
    const [descricao, setDescricao] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);
    const { toast } = useToast();

    const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Validar tamanho (máx 50MB)
        if (file.size > 50 * 1024 * 1024) {
            toast({
                title: 'Erro',
                description: 'Arquivo muito grande (máximo 50MB)',
                variant: 'destructive'
            });
            return;
        }

        // Determinar tipo
        let tipo: 'foto' | 'video' | 'documento' = 'documento';
        if (file.type.startsWith('image/')) {
            tipo = 'foto';
        } else if (file.type.startsWith('video/')) {
            tipo = 'video';
        }

        try {
            setUploading(true);
            await onUpload(file, tipo, descricao || file.name);
            setDescricao('');
            toast({
                title: 'Sucesso',
                description: 'Arquivo enviado com sucesso'
            });
        } catch (err) {
            console.error('Erro ao enviar:', err);
            toast({
                title: 'Erro',
                description: 'Erro ao enviar arquivo',
                variant: 'destructive'
            });
        } finally {
            setUploading(false);
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

    const getIconForType = (tipo: string) => {
        switch (tipo) {
            case 'foto':
                return <ImageIcon className="w-4 h-4" />;
            case 'video':
                return <Video className="w-4 h-4" />;
            default:
                return <File className="w-4 h-4" />;
        }
    };

    const formatFileSize = (bytes?: number) => {
        if (!bytes) return '';
        if (bytes < 1024) return bytes + ' B';
        if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
        return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
    };

    return (
        <div className="space-y-4">
            <div>
                <h3 className="text-lg font-semibold mb-3">📸 Evidências do Atendimento</h3>
                <p className="text-sm text-muted-foreground mb-4">
                    Faça upload de fotos, vídeos ou documentos como comprovante do atendimento
                </p>
            </div>

            {/* Upload Area */}
            {!readOnly && (
                <Card className="p-4 border-2 border-dashed">
                    <div className="space-y-3">
                        <div className="flex items-center gap-2 mb-2">
                            <label htmlFor="descricao" className="text-sm font-medium">
                                Descrição (opcional):
                            </label>
                            <input
                                id="descricao"
                                type="text"
                                placeholder="Ex: Foto do roteador instalado"
                                value={descricao}
                                onChange={(e) => setDescricao(e.target.value)}
                                className="flex-1 px-2 py-1 text-sm border rounded"
                                disabled={uploading}
                            />
                        </div>

                        <input
                            ref={fileInputRef}
                            type="file"
                            onChange={handleFileSelect}
                            disabled={uploading}
                            accept="image/*,video/*,.pdf,.doc,.docx"
                            className="hidden"
                        />

                        <Button
                            onClick={() => fileInputRef.current?.click()}
                            disabled={uploading}
                            className="w-full"
                            variant="outline"
                        >
                            {uploading ? (
                                <>
                                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                    Enviando...
                                </>
                            ) : (
                                <>
                                    <Upload className="w-4 h-4 mr-2" />
                                    Selecionar Arquivo (Foto, Vídeo ou Documento)
                                </>
                            )}
                        </Button>

                        <p className="text-xs text-muted-foreground text-center">
                            Máximo 50MB • Formatos: Imagens, Vídeos, PDF, Word
                        </p>
                    </div>
                </Card>
            )}

            {/* Evidências Lista */}
            <div className="space-y-2">
                {evidencias.length === 0 ? (
                    <p className="text-sm text-muted-foreground text-center py-4">
                        Nenhuma evidência anexada ainda
                    </p>
                ) : (
                    <div className="grid gap-2">
                        {evidencias.map((evi) => (
                            <Card key={evi.id} className="p-3 flex items-center justify-between">
                                <div className="flex items-center gap-3 flex-1 min-w-0">
                                    <div className="flex-shrink-0">
                                        {getIconForType(evi.tipo)}
                                    </div>
                                    <div className="flex-1 min-w-0">
                                        <p className="text-sm font-medium truncate">
                                            {evi.descricao}
                                        </p>
                                        <div className="flex gap-2 text-xs text-muted-foreground">
                                            <span className="capitalize bg-muted px-2 py-0.5 rounded">
                                                {evi.tipo}
                                            </span>
                                            {evi.tamanho_bytes && (
                                                <span>{formatFileSize(evi.tamanho_bytes)}</span>
                                            )}
                                            {evi.created_at && (
                                                <span>
                                                    {new Date(evi.created_at).toLocaleDateString('pt-BR')}
                                                </span>
                                            )}
                                        </div>
                                    </div>
                                </div>

                                <div className="flex items-center gap-2 flex-shrink-0">
                                    <a
                                        href={evi.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="text-xs text-blue-500 hover:underline"
                                    >
                                        Abrir
                                    </a>
                                    {!readOnly && onDelete && evi.id && (
                                        <Button
                                            onClick={() => onDelete(evi.id!)}
                                            size="sm"
                                            variant="ghost"
                                            className="h-6 w-6 p-0"
                                        >
                                            <X className="w-4 h-4" />
                                        </Button>
                                    )}
                                </div>
                            </Card>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default EvidenciasOs;
