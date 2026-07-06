export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5";
  };
  public: {
    Tables: {
      clientes: {
        Row: {
          bairro: string | null;
          cep: string | null;
          cidade: string | null;
          cpf_cnpj: string | null;
          created_at: string;
          created_by: string | null;
          data_ativacao: string | null;
          data_cancelamento: string | null;
          email: string | null;
          endereco: string | null;
          estado: string | null;
          id: string;
          ip_fixo: string | null;
          nome: string;
          numero: string | null;
          observacoes: string | null;
          plano_id: string | null;
          ppoe_pass: string | null;
          ppoe_user: string | null;
          status: Database["public"]["Enums"]["cliente_status"];
          telefone: string | null;
          updated_at: string;
        };
        Insert: {
          bairro?: string | null;
          cep?: string | null;
          cidade?: string | null;
          cpf_cnpj?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_ativacao?: string | null;
          data_cancelamento?: string | null;
          email?: string | null;
          endereco?: string | null;
          estado?: string | null;
          id?: string;
          ip_fixo?: string | null;
          nome: string;
          numero?: string | null;
          observacoes?: string | null;
          plano_id?: string | null;
          ppoe_pass?: string | null;
          ppoe_user?: string | null;
          status?: Database["public"]["Enums"]["cliente_status"];
          telefone?: string | null;
          updated_at?: string;
        };
        Update: {
          bairro?: string | null;
          cep?: string | null;
          cidade?: string | null;
          cpf_cnpj?: string | null;
          created_at?: string;
          created_by?: string | null;
          data_ativacao?: string | null;
          data_cancelamento?: string | null;
          email?: string | null;
          endereco?: string | null;
          estado?: string | null;
          id?: string;
          ip_fixo?: string | null;
          nome?: string;
          numero?: string | null;
          observacoes?: string | null;
          plano_id?: string | null;
          ppoe_pass?: string | null;
          ppoe_user?: string | null;
          status?: Database["public"]["Enums"]["cliente_status"];
          telefone?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "clientes_plano_id_fkey";
            columns: ["plano_id"];
            isOneToOne: false;
            referencedRelation: "planos";
            referencedColumns: ["id"];
          },
        ];
      };
      ordens_servico: {
        Row: {
          assinatura_cliente: string | null;
          cliente_id: string;
          created_at: string;
          created_by: string | null;
          cto_ref: string | null;
          data_agendada: string | null;
          data_conclusao: string | null;
          data_inicio: string | null;
          descricao: string;
          endereco_atendimento: string | null;
          forma_pagamento: string | null;
          id: string;
          numero: number;
          observacoes_cliente: string | null;
          observacoes_internas: string | null;
          porta_cto: number | null;
          projeto_ftth_id: string | null;
          status: Database["public"]["Enums"]["os_status"];
          tecnico_id: string | null;
          tipo: Database["public"]["Enums"]["os_tipo"];
          updated_at: string;
          valor: number | null;
        };
        Insert: {
          assinatura_cliente?: string | null;
          cliente_id: string;
          created_at?: string;
          created_by?: string | null;
          cto_ref?: string | null;
          data_agendada?: string | null;
          data_conclusao?: string | null;
          data_inicio?: string | null;
          descricao: string;
          endereco_atendimento?: string | null;
          forma_pagamento?: string | null;
          id?: string;
          numero?: number;
          observacoes_cliente?: string | null;
          observacoes_internas?: string | null;
          porta_cto?: number | null;
          projeto_ftth_id?: string | null;
          status?: Database["public"]["Enums"]["os_status"];
          tecnico_id?: string | null;
          tipo: Database["public"]["Enums"]["os_tipo"];
          updated_at?: string;
          valor?: number | null;
        };
        Update: {
          assinatura_cliente?: string | null;
          cliente_id?: string;
          created_at?: string;
          created_by?: string | null;
          cto_ref?: string | null;
          data_agendada?: string | null;
          data_conclusao?: string | null;
          data_inicio?: string | null;
          descricao?: string;
          endereco_atendimento?: string | null;
          forma_pagamento?: string | null;
          id?: string;
          numero?: number;
          observacoes_cliente?: string | null;
          observacoes_internas?: string | null;
          porta_cto?: number | null;
          projeto_ftth_id?: string | null;
          status?: Database["public"]["Enums"]["os_status"];
          tecnico_id?: string | null;
          tipo?: Database["public"]["Enums"]["os_tipo"];
          updated_at?: string;
          valor?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "ordens_servico_cliente_id_fkey";
            columns: ["cliente_id"];
            isOneToOne: false;
            referencedRelation: "clientes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "ordens_servico_projeto_ftth_id_fkey";
            columns: ["projeto_ftth_id"];
            isOneToOne: false;
            referencedRelation: "projetos_ftth";
            referencedColumns: ["id"];
          },
        ];
      };
      os_materiais: {
        Row: {
          created_at: string;
          descricao: string;
          id: string;
          os_id: string;
          quantidade: number;
          unidade: string | null;
          valor_unitario: number | null;
        };
        Insert: {
          created_at?: string;
          descricao: string;
          id?: string;
          os_id: string;
          quantidade?: number;
          unidade?: string | null;
          valor_unitario?: number | null;
        };
        Update: {
          created_at?: string;
          descricao?: string;
          id?: string;
          os_id?: string;
          quantidade?: number;
          unidade?: string | null;
          valor_unitario?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "os_materiais_os_id_fkey";
            columns: ["os_id"];
            isOneToOne: false;
            referencedRelation: "ordens_servico";
            referencedColumns: ["id"];
          },
        ];
      };
      planos: {
        Row: {
          ativo: boolean;
          created_at: string;
          id: string;
          nome: string;
          updated_at: string;
          valor: number;
          velocidade_down: number;
          velocidade_up: number;
        };
        Insert: {
          ativo?: boolean;
          created_at?: string;
          id?: string;
          nome: string;
          updated_at?: string;
          valor?: number;
          velocidade_down?: number;
          velocidade_up?: number;
        };
        Update: {
          ativo?: boolean;
          created_at?: string;
          id?: string;
          nome?: string;
          updated_at?: string;
          valor?: number;
          velocidade_down?: number;
          velocidade_up?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          created_at: string;
          full_name: string | null;
          id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          full_name?: string | null;
          id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          full_name?: string | null;
          id?: string;
          updated_at?: string;
        };
        Relationships: [];
      };
      projetos_ftth: {
        Row: {
          created_at: string;
          created_by: string | null;
          data: Json;
          descricao: string | null;
          id: string;
          nome: string;
          olt_tx_dbm: number;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          data?: Json;
          descricao?: string | null;
          id?: string;
          nome: string;
          olt_tx_dbm?: number;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          data?: Json;
          descricao?: string | null;
          id?: string;
          nome?: string;
          olt_tx_dbm?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_roles: {
        Row: {
          created_at: string;
          id: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          role: Database["public"]["Enums"]["app_role"];
          user_id: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          role?: Database["public"]["Enums"]["app_role"];
          user_id?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      has_any_role: { Args: { _user_id: string }; Returns: boolean };
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"];
          _user_id: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      app_role: "admin" | "tecnico" | "atendente";
      cliente_status: "ativo" | "bloqueado" | "cancelado";
      os_status: "aberta" | "agendada" | "em_andamento" | "concluida" | "cancelada";
      os_tipo: "instalacao" | "manutencao" | "mudanca_endereco" | "visita_tecnica";
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    keyof DefaultSchema["Tables"] | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    keyof DefaultSchema["Enums"] | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    keyof DefaultSchema["CompositeTypes"] | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "tecnico", "atendente"],
      cliente_status: ["ativo", "bloqueado", "cancelado"],
      os_status: ["aberta", "agendada", "em_andamento", "concluida", "cancelada"],
      os_tipo: ["instalacao", "manutencao", "mudanca_endereco", "visita_tecnica"],
    },
  },
} as const;
