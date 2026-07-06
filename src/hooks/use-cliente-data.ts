import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

interface ClienteCompleto {
    id: string;
    nome: string;
    endereco: string | null;
    numero: string | null;
    bairro: string | null;
    cidade: string | null;
    estado: string | null;
    cep: string | null;
    telefone: string | null;
    cpf_cnpj: string | null;
}

/**
 * Hook para buscar dados completos do cliente e gerar endereço formatado
 */
export function useClienteData() {
    const [selectedClientId, setSelectedClientId] = useState<string>('');

    // Buscar dados completos do cliente selecionado
    const { data: clienteData } = useQuery({
        queryKey: ['cliente-completo', selectedClientId],
        enabled: !!selectedClientId,
        queryFn: async () => {
            if (!selectedClientId) return null;

            const { data, error } = await supabase
                .from('clientes')
                .select('*')
                .eq('id', selectedClientId)
                .single();

            if (error) throw error;
            return data as ClienteCompleto;
        }
    });

    /**
     * Formatar endereço completo do cliente
     */
    const formatEnderecoCliente = useCallback((cliente: ClienteCompleto | null): string => {
        if (!cliente) return '';

        const partes = [
            cliente.endereco,
            cliente.numero,
            cliente.bairro,
            cliente.cidade,
            cliente.estado,
            cliente.cep
        ].filter(Boolean);

        return partes.join(', ');
    }, []);

    /**
     * Obter endereço formatado do cliente selecionado
     */
    const getEnderecoFormatado = useCallback((): string => {
        return formatEnderecoCliente(clienteData || null);
    }, [clienteData, formatEnderecoCliente]);

    /**
     * Obter dados completos do cliente
     */
    const getClienteAtual = useCallback((): ClienteCompleto | null => {
        return clienteData || null;
    }, [clienteData]);

    return {
        selectedClientId,
        setSelectedClientId,
        clienteData,
        getEnderecoFormatado,
        getClienteAtual,
        formatEnderecoCliente
    };
}

export default useClienteData;
