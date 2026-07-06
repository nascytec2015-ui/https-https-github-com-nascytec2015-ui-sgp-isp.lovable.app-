import { useState, useCallback } from 'react';
import { useSupabase } from '@/integrations/supabase/use-supabase';
import { useToast } from './use-toast';

interface OsEvidencia {
    id?: string;
    os_id: string;
    url: string;
    tipo: 'foto' | 'video' | 'documento';
    descricao: string;
    tamanho_bytes?: number;
    mime_type?: string;
    created_at?: string;
}

interface UseOsEvidenciasReturn {
    evidencias: OsEvidencia[];
    loading: boolean;
    uploadingFile: boolean;
    fetchEvidencias: (osId: string) => Promise<void>;
    uploadEvidencia: (osId: string, file: File, tipo: string, descricao: string) => Promise<void>;
    deleteEvidencia: (evidenciaId: string, url: string) => Promise<void>;
}

/**
 * Hook para gerenciar evidências de Ordem de Serviço
 */
export function useOsEvidencias(): UseOsEvidenciasReturn {
    const supabase = useSupabase();
    const { toast } = useToast();
    const [evidencias, setEvidencias] = useState<OsEvidencia[]>([]);
    const [loading, setLoading] = useState(false);
    const [uploadingFile, setUploadingFile] = useState(false);

    // Buscar evidências de uma OS
    const fetchEvidencias = useCallback(async (osId: string) => {
        if (!supabase) return;

        try {
            setLoading(true);
            const { data, error } = await supabase
                .from('os_evidencias')
                .select('*')
                .eq('os_id', osId)
                .order('created_at', { ascending: false });

            if (error) throw error;
            setEvidencias(data || []);
        } catch (err) {
            console.error('Erro ao buscar evidências:', err);
            toast({
                title: 'Erro',
                description: 'Erro ao carregar evidências',
                variant: 'destructive'
            });
        } finally {
            setLoading(false);
        }
    }, [supabase, toast]);

    // Upload de evidência
    const uploadEvidencia = useCallback(
        async (osId: string, file: File, tipo: string, descricao: string) => {
            if (!supabase) return;

            try {
                setUploadingFile(true);

                // Gerar caminho único no Storage
                const timestamp = Date.now();
                const random = Math.random().toString(36).substr(2, 9);
                const fileName = `${osId}/${timestamp}-${random}-${file.name}`;

                // Upload para Storage
                const { data: uploadData, error: uploadError } = await supabase.storage
                    .from('os_evidencias')
                    .upload(fileName, file, {
                        cacheControl: '3600',
                        upsert: false
                    });

                if (uploadError) throw uploadError;

                // Obter URL pública
                const { data: urlData } = supabase.storage
                    .from('os_evidencias')
                    .getPublicUrl(uploadData.path);

                // Registrar na tabela
                const { error: dbError } = await supabase
                    .from('os_evidencias')
                    .insert([
                        {
                            os_id: osId,
                            url: urlData.publicUrl,
                            tipo,
                            descricao,
                            tamanho_bytes: file.size,
                            mime_type: file.type
                        }
                    ]);

                if (dbError) throw dbError;

                // Recarregar evidências
                await fetchEvidencias(osId);

                toast({
                    title: 'Sucesso',
                    description: 'Evidência anexada com sucesso'
                });
            } catch (err) {
                console.error('Erro ao enviar evidência:', err);
                throw err;
            } finally {
                setUploadingFile(false);
            }
        },
        [supabase, fetchEvidencias, toast]
    );

    // Deletar evidência
    const deleteEvidencia = useCallback(
        async (evidenciaId: string, url: string) => {
            if (!supabase) return;

            try {
                setUploadingFile(true);

                // Extrair caminho do URL
                const urlObj = new URL(url);
                const pathParts = urlObj.pathname.split('/storage/v1/object/public/os_evidencias/');
                const filePath = pathParts[1];

                if (filePath) {
                    // Deletar do Storage
                    await supabase.storage
                        .from('os_evidencias')
                        .remove([filePath]);
                }

                // Deletar registro da tabela
                const { error } = await supabase
                    .from('os_evidencias')
                    .delete()
                    .eq('id', evidenciaId);

                if (error) throw error;

                // Atualizar lista local
                setEvidencias((prev) => prev.filter((e) => e.id !== evidenciaId));

                toast({
                    title: 'Sucesso',
                    description: 'Evidência removida com sucesso'
                });
            } catch (err) {
                console.error('Erro ao deletar evidência:', err);
                toast({
                    title: 'Erro',
                    description: 'Erro ao remover evidência',
                    variant: 'destructive'
                });
            } finally {
                setUploadingFile(false);
            }
        },
        [supabase, toast]
    );

    return {
        evidencias,
        loading,
        uploadingFile,
        fetchEvidencias,
        uploadEvidencia,
        deleteEvidencia
    };
}

export default useOsEvidencias;
