import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useQueryClient, useMutation } from "@tanstack/react-query";
import { useEffect, useState, useRef } from "react";
import { toast } from "sonner";
import {
  Plus,
  Pencil,
  Trash2,
  ClipboardList,
  Search,
  X,
} from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth-context";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent } from "@/components/ui/card";

import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";

import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

import { Badge } from "@/components/ui/badge";



export const Route = createFileRoute("/_authenticated/os")({
  head: () => ({
    meta: [
      {
        title: "Ordens de Serviço — ISP Manager",
      },
    ],
  }),

  component: OSPage,
});



type OSTipo =
  | "instalacao"
  | "manutencao"
  | "mudanca_endereco"
  | "visita_tecnica";



type OSStatus =
  | "aberta"
  | "agendada"
  | "em_execucao"
  | "em_deslocamento"
  | "aguardando_material"
  | "concluida"
  | "cancelada";



type Material = {
  id?: string;
  descricao: string;
  quantidade: number;
  unidade: string;
};



type Evidencia = {
  id?: string;

  tipo:
  | "foto"
  | "video";

  arquivo:
  | File
  | null;

  descricao:
  string;

  url?:
  string;
};



type OS = {

  id:
  string;

  numero:
  number;

  cliente_id:
  string;


  tipo:
  OSTipo;


  status:
  OSStatus;


  descricao:
  string;


  tecnico_id:
  string | null;


  cto_ref:
  string | null;


  porta_cto:
  number | null;


  endereco_atendimento:
  string | null;


  data_agendada:
  string | null;


  data_inicio:
  string | null;


  data_conclusao:
  string | null;


  assinatura_cliente:
  string | null;


  observacoes_cliente:
  string | null;


  observacoes_internas:
  string | null;



  clientes?: {

    nome:
    string;

  } | null;

};

const TIPO_LABEL: Record<OSTipo, string> = {

  instalacao:
    "Instalação",

  manutencao:
    "Manutenção/Reparo",

  mudanca_endereco:
    "Mudança de endereço",

  visita_tecnica:
    "Visita técnica",

};




const STATUS_LABEL: Record<OSStatus, string> = {

  aberta:
    "Aberta",

  agendada:
    "Agendada",

  em_execucao:
    "Em execução",

  em_deslocamento:
    "Em deslocamento",

  aguardando_material:
    "Aguardando material",

  concluida:
    "Concluída",

  cancelada:
    "Cancelada",

};




const STATUS_VARIANT: Record<
  OSStatus,
  "default" |
  "secondary" |
  "destructive" |
  "outline"
> = {


  aberta:
    "outline",

  agendada:
    "secondary",

  em_execucao:
    "default",

  em_deslocamento:
    "default",

  aguardando_material:
    "default",

  concluida:
    "secondary",

  cancelada:
    "destructive",

};




const osSchema = z.object({

  cliente_id:
    z.string()
      .uuid("Selecione um cliente"),


  tipo:
    z.enum([
      "instalacao",
      "manutencao",
      "mudanca_endereco",
      "visita_tecnica",
    ]),


  status:
    z.enum([
      "aberta",
      "agendada",
      "em_execucao",
      "em_deslocamento",
      "aguardando_material",
      "concluida",
      "cancelada",
    ]),


  descricao:
    z.string()
      .trim()
      .min(3, "Descreva o serviço")
      .max(2000),


  tecnico_id:
    z.string()
      .uuid()
      .nullable(),


  cto_ref:
    z.string()
      .max(80)
      .nullable(),

  porta_cto:
    z.number()
      .int()
      .min(0)
      .max(999)
      .nullable(),

  endereco_atendimento:
    z.string()
      .max(300)
      .nullable(),

  data_agendada:
    z.string()
      .nullable(),

  data_inicio:
    z.string()
      .nullable(),

  data_conclusao:
    z.string()
      .nullable(),

  assinatura_cliente:
    z.string()
      .max(120)
      .nullable(),

  observacoes_cliente:
    z.string()
      .max(1000)
      .nullable(),

  observacoes_internas:
    z.string()
      .max(1000)
      .nullable(),

});

function toDtLocal(
  v: string | null | undefined
) {

  if (!v)
    return "";


  const d = new Date(v);


  const pad =
    (n: number) =>
      String(n).padStart(2, "0");


  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;

}
function OSPage() {


  async function uploadEvidencia(
    osId: string,
    evidencia: Evidencia
  ) {

    if (!evidencia.arquivo)
      return;
    const arquivo = evidencia.arquivo;

    const nomeArquivo =
      `${osId}/${Date.now()}-${arquivo.name}`;

    const { error: uploadError } =
      await supabase
        .storage
        .from("os-evidencias")
        .upload(
          nomeArquivo,
          arquivo
        );

    if (uploadError)
      throw uploadError;

    const { data: urlData } =
      supabase
        .storage
        .from("os-evidencias")
        .getPublicUrl(nomeArquivo);

    const {
      data: authData,
    } = await supabase.auth.getUser();

    const { error: dbError } =
      await supabase
        .from("os_evidencias")
        .insert({
          os_id: osId,
          tipo: evidencia.tipo,
          url: urlData.publicUrl,
          descricao: evidencia.descricao || "",
          mime_type: arquivo.type,
          tamanho_bytes: arquivo.size,
          criado_por: authData.user!.id,
        });

    if (dbError)
      throw dbError;

  }




  const qc = useQueryClient();


  const {
    isAdmin,
    hasRole
  } = useAuth();



  const canCreate =
    isAdmin ||
    hasRole("atendente");




  const [open, setOpen] =
    useState(false);



  const [editing, setEditing] =
    useState<OS | null>(null);




  const [evidencias, setEvidencias] =
    useState<Evidencia[]>([]);



  const [materiais, setMateriais] =
    useState<Material[]>([]);




  const [filter, setFilter] =
    useState("");



  const [statusFilter, setStatusFilter] =
    useState<OSStatus | "todos">("todos");




  const [selectedClientId, setSelectedClientId] =
    useState("");



  const [enderecoPreenchido, setEnderecoPreenchido] =
    useState("");



  const enderecoInputRef =
    useRef<HTMLInputElement>(null);





  const { data: clienteData } =
    useQuery({

      queryKey: [
        "cliente-completo",
        selectedClientId
      ],


      enabled:
        !!selectedClientId,


      queryFn:
        async () => {


          const {
            data,
            error
          } =
            await supabase
              .from("clientes")
              .select(
                "endereco, numero, bairro, cidade, estado, cep"
              )
              .eq(
                "id",
                selectedClientId
              )
              .single();



          if (error)
            throw error;


          return data;

        }

    });





  useEffect(() => {


    if (clienteData) {


      const partes = [

        clienteData.endereco,

        clienteData.numero,

        clienteData.bairro,

        clienteData.cidade,

        clienteData.estado,

        clienteData.cep

      ].filter(Boolean);



      const endereco =
        partes.join(", ");



      setEnderecoPreenchido(endereco);



      if (enderecoInputRef.current) {

        enderecoInputRef.current.value =
          endereco;

      }


    }


  }, [clienteData]);

  const {
    data: ordens = [],
    isLoading
  } =
    useQuery({

      queryKey: [
        "ordens_servico"
      ],

      queryFn:
        async () => {


          const {
            data,
            error
          } =
            await supabase
              .from("ordens_servico")
              .select(`
          *,
          clientes(
            nome
          )
        `)
              .order(
                "numero",
                {
                  ascending: false
                }
              );


          if (error)
            throw error;
          return data as unknown as OS[];

        }

    });

  const {
    data: clientes = []
  } =
    useQuery({

      queryKey: [
        "clientes-min"
      ],

      queryFn:
        async () => {


          const {
            data,
            error
          } =
            await supabase
              .from("clientes")
              .select(
                "id,nome"
              )
              .order(
                "nome"
              );

          if (error)
            throw error;

          return data as {
            id: string;
            nome: string;
          }[];

        }

    });

  const {
    data: tecnicos = []
  } =
    useQuery({

      queryKey: [
        "tecnicos"
      ],

      queryFn:
        async () => {


          const {
            data,
            error
          } =
            await supabase
              .from("user_roles")
              .select(
                "user_id, profiles(full_name)"
              )
              .eq(
                "role",
                "tecnico"
              );

          if (error)
            throw error;

          return (data ?? [])
            .map((r: any) => ({

              id:
                r.user_id,
              nome:
                r.profiles?.full_name ||
                "Técnico"

            }));

        }

    });

  const {
    data: materiaisEdit = []
  } =
    useQuery({

      queryKey: [
        "os_materiais",
        editing?.id
      ],

      enabled:
        !!editing?.id,

      queryFn:
        async () => {

          const {
            data,
            error
          } =
            await supabase
              .from("os_materiais")
              .select("*")
              .eq(
                "os_id",
                editing!.id
              );

          if (error)
            throw error;

          return data as Material[];

        }

    });

  function openNew() {


    setEditing(null);

    setMateriais([]);

    setEvidencias([]);

    setSelectedClientId("");

    setEnderecoPreenchido("");

    setOpen(true);

  }

  function openEdit(o: OS) {


    setEditing(o);

    setMateriais([]);

    setEvidencias([]);

    setSelectedClientId(
      o.cliente_id
    );

    setEnderecoPreenchido(
      o.endereco_atendimento || ""
    );

    setOpen(true);

  }

  useEffect(() => {

    if (
      editing?.id &&
      materiaisEdit.length > 0 &&
      materiais.length === 0
    ) {

      setMateriais(
        materiaisEdit
      );

    }

  }, [
    editing?.id,
    materiaisEdit,
    materiais.length
  ]);

  const save =
    useMutation({

      mutationFn:
        async (form: FormData) => {

          const parsed =
            osSchema.parse({

              cliente_id:
                String(
                  form.get("cliente_id") ?? ""
                ),

              tipo:
                form.get("tipo"),

              status:
                form.get("status"),

              descricao:
                form.get("descricao"),

              tecnico_id:
                String(
                  form.get("tecnico_id") ?? ""
                ) ||
                null,

              cto_ref:
                String(
                  form.get("cto_ref") ?? ""
                ) ||
                null,

              porta_cto:
                form.get("porta_cto")
                  ?
                  Number(
                    form.get("porta_cto")
                  )
                  :
                  null,

              endereco_atendimento:
                String(
                  form.get("endereco_atendimento") ?? ""
                ) ||
                null,

              data_agendada:
                String(
                  form.get("data_agendada") ?? ""
                ) ||
                null,

              data_inicio:
                String(
                  form.get("data_inicio") ?? ""
                ) ||
                null,

              data_conclusao:
                String(
                  form.get("data_conclusao") ?? ""
                ) ||
                null,

              assinatura_cliente:
                String(
                  form.get("assinatura_cliente") ?? ""
                ) ||
                null,

              observacoes_cliente:
                String(
                  form.get("observacoes_cliente") ?? ""
                ) ||
                null,

              observacoes_internas:
                String(
                  form.get("observacoes_internas") ?? ""
                ) ||
                null,
            });

          const payload = {
            ...parsed,

            data_agendada:
              parsed.data_agendada
                ?
                new Date(
                  parsed.data_agendada
                ).toISOString()
                :
                null,

            data_inicio:
              parsed.data_inicio
                ?
                new Date(
                  parsed.data_inicio
                ).toISOString()
                :
                null,

            data_conclusao:
              parsed.data_conclusao
                ?
                new Date(
                  parsed.data_conclusao
                ).toISOString()
                :
                null,

          };

          let osId: string;

          if (editing) {

            const {
              error
            } =
              await supabase
                .from("ordens_servico")
                .update(payload)
                .eq(
                  "id",
                  editing.id
                );

            if (error)
              throw error;

            osId =
              editing.id;

            await supabase
              .from("os_materiais")
              .delete()
              .eq(
                "os_id",
                osId
              );

          }

          else {

            const {
              data: u
            } =
              await supabase.auth.getUser();

            const {
              data,
              error
            } =
              await supabase
                .from("ordens_servico")
                .insert({
                  ...payload,
                  created_by:
                    u.user?.id ?? null
                })
                .select("id")
                .single();

            if (error)
              throw error;

            osId =
              data.id;

          }

          for (
            const evidencia
            of evidencias
          ) {

            await uploadEvidencia(
              osId,
              evidencia
            );

          }

          const mats =
            materiais.filter(
              m =>
                m.descricao.trim()
            );

          if (mats.length) {
            const {
              error
            } =
              await supabase
                .from("os_materiais")
                .insert(

                  mats.map(
                    m => ({
                      ...m,
                      os_id: osId
                    })
                  )

                );

            if (error)
              throw error;

          }

        },

      onSuccess: () => {

        toast.success(
          editing
            ?
            "OS atualizada"
            :
            "OS criada"
        );

        qc.invalidateQueries({
          queryKey: [
            "ordens_servico"
          ]
        });

        setOpen(false);

        setEditing(null);

        setMateriais([]);

        setEvidencias([]);


      },

      onError: (e: Error) => {

        toast.error(
          e.message
        );

      }

    });
  const remove =
    useMutation({

      mutationFn:
        async (id: string) => {


          const {
            error
          } =
            await supabase
              .from("ordens_servico")
              .delete()
              .eq(
                "id",
                id
              );

          if (error)
            throw error;

        },

      onSuccess: () => {

        toast.success(
          "OS removida"
        );


        qc.invalidateQueries({

          queryKey: [
            "ordens_servico"
          ]

        });

      },

      onError: (e: Error) => {
        toast.error(
          e.message
        );

      }

    });

  const filtered =
    ordens.filter((o) => {
      const t =
        filter.toLowerCase();
      const matchText =
        !t ||
        String(o.numero)
          .includes(t) ||

        o.clientes?.nome
          ?.toLowerCase()
          .includes(t) ||

        o.descricao
          ?.toLowerCase()
          .includes(t);

      const matchStatus =
        statusFilter === "todos" ||
        o.status === statusFilter;

      return (
        matchText &&
        matchStatus
      );

    });

  return (

    <div className="space-y-6">
      <div className="
        flex
        items-center
        justify-between
        flex-wrap
        gap-3
      ">
        <div>

          <h1 className="
            text-3xl
            font-bold
            tracking-tight
          ">
            Ordens de Serviço
          </h1>

          <p className="
            text-muted-foreground
          ">
            Gerencie instalações,
            manutenções e visitas técnicas
          </p>


        </div>


        {
          canCreate && (

            <Button
              onClick={openNew}
            >

              <Plus
                className="
                  h-4
                  w-4
                  mr-2
                "
              />

              Nova OS

            </Button>

          )
        }


      </div>

      <Card>

        <CardContent
          className="p-4 space-y-4"
        >

          <div
            className="
              flex
              flex-wrap
              gap-3
            "
          >

            <div
              className="
                relative
                flex-1
                min-w-[200px]
              "
            >

              <Search
                className="
                  absolute
                  left-3
                  top-1/2
                  -translate-y-1/2
                  h-4
                  w-4
                  text-muted-foreground"
              />
              <Input

                className="
                  pl-9"

                placeholder="
                  Buscar número,
                  cliente ou descrição..."

                value={filter}

                onChange={(e)=>
                  setFilter(
                    e.target.value
                  )
                }

              />
</div>

  <select
  value={statusFilter}
  onChange={(e) =>
    setStatusFilter(e.target.value as OSStatus | "todos")
  }
  className="
    h-10 
    rounded-md
    border
    px-3
    text-sm">  
             
              <option value="todos">
                Todos os status
              </option>

              {
                (
                  Object.keys(
                    STATUS_LABEL
                  )
                  as OSStatus[]
                )
                .map((s)=>(

                  <option
                    key={s}
                    value={s}
                  >
                    {STATUS_LABEL[s]}
                  </option>

                ))
              }

            </select>


          </div>

          {
            isLoading ?

            (

              <div className="
                p-8
                text-center
                text-muted-foreground
              ">
                Carregando...
              </div>

            ):

            filtered.length===0 ?

            (

              <div className="
                p-12
                text-center
                text-muted-foreground
              ">

                <ClipboardList
                  className="
                    h-10
                    w-10
                    mx-auto
                    mb-2
                    opacity-50
                  "
                />

                Nenhuma OS encontrada

              </div>

            ):

            (

              <Table>


                <TableHeader>


                  <TableRow>


                    <TableHead>
                      #
                    </TableHead>


                    <TableHead>
                      Cliente
                    </TableHead>


                    <TableHead>
                      Tipo
                    </TableHead>


                    <TableHead>
                      Status
                    </TableHead>


                    <TableHead>
                      Agendada
                    </TableHead>


                    <TableHead
                      className="
                        text-right
                      "
                    >
                      Ações
                    </TableHead>


                  </TableRow>


                </TableHeader>

                <TableBody>
                  {
                    filtered.map((o)=>(


                      <TableRow
                        key={o.id}
                      >

                        <TableCell
                          className="
                            font-mono
                          "
                        >

                          #{o.numero}

                        </TableCell>

                        <TableCell
                          className="
                            font-medium
                          "
                        >

                          {
                            o.clientes?.nome
                            ??
                            "—"
                          }

                        </TableCell>

                        <TableCell>

                          {
                            TIPO_LABEL[o.tipo]
                          }

                        </TableCell>
                        <TableCell>
                          <Badge
                            variant={
                              STATUS_VARIANT[o.status]
                            }
                          >

                            {
                              STATUS_LABEL[o.status]
                            }

                          </Badge>

                        </TableCell>
                        <TableCell
                          className="
                            text-sm
                          "
                        >

                          {
                            o.data_agendada

                            ?

                            new Date(
                              o.data_agendada
                            )
                            .toLocaleString(
                              "pt-BR"
                            )

                            :

                            "—"
                          }

                        </TableCell>

                        <TableCell
                          className="
                            text-right
                            space-x-1
                          "
                        >
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() =>
                              openEdit(o)
                            }
                          >

                            <Pencil
                              className="
                                h-4
                                w-4
                              "
                            />

                          </Button>



                          {
                            isAdmin && (

                              <Button

                                variant="ghost"

                                size="icon"

                                onClick={()=>{

                                  if(
                                    confirm(
                                      `Remover OS #${o.numero}?`
                                    )
                                  ){

                                    remove.mutate(
                                      o.id
                                    );

                                  }

                                }}

                              >

                                <Trash2
                                  className="
                                    h-4
                                    w-4
                                    text-destructive
                                  "
                                />

                              </Button>

                            )
                          }


                        </TableCell>
                      </TableRow>


                    ))
                  }


                </TableBody>
              </Table>


            )

          }


        </CardContent>
      </Card>
      <Dialog

        open={open}
        onOpenChange={(v)=>{
          setOpen(v);



          if(!v){

            setEditing(null);
            setMateriais([]);
            setEvidencias([]);
            setSelectedClientId("");
            setEnderecoPreenchido("");

          }

        }}

      >

        <DialogContent
          className="
            max-w-3xl
            max-h-[90vh]
            overflow-y-auto
          "
        >

          <DialogHeader>
            <DialogTitle>

              {
                editing
                ?
                `Editar OS #${editing.numero}`
                :
                "Nova Ordem de Serviço"
              }

            </DialogTitle>
          </DialogHeader>

          <form

            onSubmit={(e)=>{

              e.preventDefault();

              save.mutate(
                new FormData(
                  e.currentTarget
                )
              );

            }}

            className="
              space-y-4
            "

          >
            <div
              className="
                grid
                grid-cols-1
                md:grid-cols-2
                gap-3
              "
            >
              <div
                className="
                  space-y-2
                "
              >

                <Label>
                  Cliente *
                </Label>

                <select

                  name="cliente_id"

                  value={selectedClientId}

                  onChange={(e)=>
                    setSelectedClientId(
                      e.target.value
                    )
                  }

                  required

                  className="
                    w-full
                    h-10
                    rounded-md
                    border
                    px-3
                  "

                >

                  <option value="">
                    Selecione...
                  </option>

                  {
                    clientes.map(c=>(

                      <option
                        key={c.id}
                        value={c.id}
                      >

                        {c.nome}

                      </option>

                    ))
                  }


                </select>


              </div>

              <div className="space-y-2">


                <Label>
                  Tipo *
                </Label>


                <select

                  name="tipo"

                  defaultValue={
                    editing?.tipo ??
                    "instalacao"
                  }

                  className="
                    w-full
                    h-10
                    rounded-md
                    border
                    px-3
                  "

                >

                  {
                    (
                      Object.keys(
                        TIPO_LABEL
                      )
                      as OSTipo[]
                    )
                    .map(t=>(

                      <option
                        key={t}
                        value={t}
                      >

                        {TIPO_LABEL[t]}

                      </option>

                    ))
                  }

                </select>


              </div>

              <div className="space-y-2">


                <Label>
                  Status *
                </Label>


                <select

                  name="status"

                  defaultValue={
                    editing?.status ??
                    "aberta"
                  }

                  className="
                    w-full
                    h-10
                    rounded-md
                    border
                    px-3
                  "

                >

                  {
                    (
                      Object.keys(
                        STATUS_LABEL
                      )
                      as OSStatus[]
                    )
                    .map(s=>(

                      <option
                        key={s}
                        value={s}
                      >

                        {STATUS_LABEL[s]}

                      </option>

                    ))
                  }

                </select>
              </div>

              <div className="space-y-2">


                <Label>
                  Técnico
                </Label>


                <select

                  name="tecnico_id"

                  defaultValue={
                    editing?.tecnico_id ??
                    ""
                  }

                  className="
                    w-full
                    h-10
                    rounded-md
                    border
                    px-3
                  "

                >

                  <option value="">
                    Não atribuído
                  </option>

                  {
                    tecnicos.map(t=>(

                      <option
                        key={t.id}
                        value={t.id}
                      >

                        {t.nome}

                      </option>

                    ))
                  }


                </select>
              </div>

            </div>
            <div className="space-y-2">

              <Label>
                Descrição *
              </Label>
              <Textarea

                name="descricao"

                defaultValue={
                  editing?.descricao ??
                  ""
                }

                rows={3}

                required

              />
            </div>

            <div className="space-y-2">

              <Label>
                Endereço atendimento
              </Label>
              <Input

                ref={enderecoInputRef}

                name="endereco_atendimento"

                defaultValue={
                  editing?.endereco_atendimento ??
                  ""
                }

              />

              {
                enderecoPreenchido && (

                  <p className="
                    text-xs
                    text-muted-foreground
                  ">

                    📍 {enderecoPreenchido}

                  </p>

                )
              }


            </div>

            <div
              className="
                grid
                grid-cols-2
                gap-3
              "
            >
              <Input

                name="cto_ref"

                placeholder="CTO/Caixa"

                defaultValue={
                  editing?.cto_ref ??
                  ""
                }

              />

              <Input

                name="porta_cto"

                type="number"

                placeholder="Porta"

                defaultValue={
                  editing?.porta_cto ??
                  ""
                }

              />


            </div>

            <div
              className="
                grid
                md:grid-cols-3
                gap-3
              "
            >

              <Input

                name="data_agendada"

                type="datetime-local"

                defaultValue={
                  toDtLocal(
                    editing?.data_agendada
                  )
                }

              />

              <Input

                name="data_inicio"

                type="datetime-local"

                defaultValue={
                  toDtLocal(
                    editing?.data_inicio
                  )
                }

              />

              <Input

                name="data_conclusao"

                type="datetime-local"

                defaultValue={
                  toDtLocal(
                    editing?.data_conclusao
                  )
                }

              />


            </div>
            <div
              className="
                space-y-2
                border
                rounded-lg
                p-3
              "
            >

              <div
                className="
                  flex
                  items-center
                  justify-between
                "
              >

                <Label>
                  Equipamentos / materiais usados
                </Label>


                <Button

                  type="button"

                  variant="outline"

                  size="sm"

                  onClick={()=>{

                    setMateriais((m)=>[

                      ...m,

                      {
                        descricao:"",
                        quantidade:1,
                        unidade:"un"
                      }

                    ]);

                  }}

                >

                  <Plus
                    className="
                      h-3
                      w-3
                      mr-1
                    "
                  />

                  Adicionar

                </Button>


              </div>

              {
                materiais.map((m,i)=>(

                  <div
                    key={i}
                    className="
                      grid
                      grid-cols-12
                      gap-2
                      items-center
                    "
                  >


                    <Input

                      className="
                        col-span-6
                      "

                      placeholder="Descrição"

                      value={m.descricao}

                      onChange={(e)=>{

                        setMateriais(arr=>

                          arr.map((x,j)=>

                            j===i

                            ?

                            {
                              ...x,
                              descricao:e.target.value
                            }

                            :

                            x

                          )

                        );

                      }}

                    />

                    <Input

                      className="
                        col-span-2
                      "

                      type="number"

                      value={m.quantidade}

                      onChange={(e)=>{

                        setMateriais(arr=>

                          arr.map((x,j)=>

                            j===i

                            ?

                            {
                              ...x,
                              quantidade:Number(
                                e.target.value
                              )
                            }

                            :

                            x

                          )

                        );

                      }}

                    />

                    <Input

                      className="
                        col-span-3
                      "

                      value={m.unidade}

                      onChange={(e)=>{

                        setMateriais(arr=>

                          arr.map((x,j)=>

                            j===i

                            ?

                            {
                              ...x,
                              unidade:e.target.value
                            }

                            :

                            x

                          )

                        );

                      }}

                    />





                    <Button

                      type="button"

                      variant="ghost"

                      size="icon"

                      onClick={()=>{

                        setMateriais(arr=>

                          arr.filter(
                            (_,j)=>j!==i
                          )

                        );

                      }}

                    >

                      <Trash2
                        className="
                          h-4
                          w-4
                          text-destructive
                        "
                      />

                    </Button>



                  </div>


                ))
              }

            </div>

            <div
              className="
                space-y-3
                border
                rounded-lg
                p-4
              "
            >

              <Label>
                Evidências do serviço
              </Label>

              <Input

                type="file"

                accept="image/*,video/*"

                multiple

                onChange={(e)=>{

                  const files =
                    Array.from(
                      e.target.files || []
                    );

                  setEvidencias(old=>[

                    ...old,
                    ...files.map(file=>({
                      tipo:
                        file.type.startsWith("video")
                        ?
                        "video"
                        :
                        "foto",
                      arquivo:
                        file,
                      descricao:""

                    }))

                  ]);


                }}

              />

              {
                evidencias.map((ev,index)=>(

                  <div

                    key={index}

                    className="
                      flex
                      gap-2
                      items-center
                      border
                      p-2
                      rounded
                    "

                  >

                    <div
                      className="
                        flex-1
                      "
                    >

                      <p
                        className="
                          text-sm
                        "
                      >

                        {
                          ev.tipo==="foto"
                          ?
                          "📷 Foto"
                          :
                          "🎥 Vídeo"
                        }

                        {" - "}

                        {
                          ev.arquivo?.name
                        }

                      </p>

                      <Input

                        placeholder="
                          Descrição da evidência
                        "
                        value={
                          ev.descricao
                        }

                        onChange={(e)=>{
                          setEvidencias(arr=>
                            arr.map((x,i)=>
                             i===index

                              ?

                              {
                                ...x,
                                descricao:
                                  e.target.value
                              }

                              :

                              x

                            )


                          );


                        }}

                      />

                    </div>

                    <Button

                      type="button"

                      variant="ghost"

                      onClick={()=>{


                        setEvidencias(arr=>

                          arr.filter(
                            (_,i)=>i!==index
                          )

                        );


                      }}

                    >

                      <X
                        className="
                          h-4
                          w-4
                        "
                      />


                    </Button>

                  </div>

                ))
              }

            </div>
            <div className="space-y-2">

              <Label>
                Assinatura / nome do recebedor
              </Label>
              <Input

                name="assinatura_cliente"

                defaultValue={
                  editing?.assinatura_cliente ?? ""
                }

                placeholder="
                  Nome de quem assinou
                "

              />

            </div>
            <div
              className="
                grid
                md:grid-cols-2
                gap-3
              "
            >
              <div
                className="
                  space-y-2
                "
              >

                <Label>
                  Observações do cliente
                </Label>
                <Textarea

                  name="observacoes_cliente"

                  defaultValue={
                    editing?.observacoes_cliente ?? ""
                  }

                  rows={3}

                />

              </div>
              <div
                className="
                  space-y-2
                "
              >

                <Label>
                  Observações internas
                </Label>

                <Textarea

                  name="observacoes_internas"

                  defaultValue={
                    editing?.observacoes_internas ?? ""
                  }

                  rows={3}

                />
              </div>
            </div>

            <DialogFooter>
              <Button

                type="submit"

                disabled={
                  save.isPending
                }
>
                {
                  save.isPending
                  ?
                  "Salvando..."
                  :
                  "Salvar OS"
                }

              </Button>
            </DialogFooter>

          </form>

        </DialogContent>
      </Dialog>


    </div >
  );

}
