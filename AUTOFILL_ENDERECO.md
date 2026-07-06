# 🎯 Preenchimento Automático de Endereço na O.S.

## Como Funciona

Quando você **seleciona um cliente** ao criar ou editar uma Ordem de Serviço, o endereço dele é **automaticamente preenchido** no campo "Endereço de atendimento".

### Dados Preenchidos Automaticamente:
- ✅ Endereço (rua)
- ✅ Número
- ✅ Bairro
- ✅ Cidade
- ✅ Estado
- ✅ CEP

### Formato do Endereço:
```
Rua Brasil, 123, Centro, São Paulo, SP, 01234-567
```

---

## Fluxo de Uso

### Criar Nova O.S.:
1. Clique em "Nova OS"
2. No campo **"Cliente"**, selecione um cliente da lista
3. ✨ O campo **"Endereço de atendimento"** é preenchido automaticamente
4. (Opcionalmente) Pode editar o endereço se necessário
5. Preencha os demais campos
6. Clique em "Salvar"

### Editar O.S. Existente:
1. Clique em editar na tabela
2. O cliente já está selecionado
3. O endereço fica visível com um emoji 📍
4. Faça as alterações necessárias
5. Clique em "Salvar"

---

## Características

### 🔄 Recarregamento Automático
- Quando você **troca de cliente**, o novo endereço aparece automaticamente
- O campo mostra uma dica: "📍 Preenchido automaticamente: [endereço]"

### ✏️ Edição Liberada
- Você pode **editar o endereço manualmente** se necessário
- O endereço pode ser diferente do cadastro do cliente

### 🔍 Validação
- Se deixar vazio, assume o do cliente
- Se preencher, usa o novo endereço

---

## Código Técnico

### Hook Custom
Arquivo: `src/hooks/use-cliente-data.ts`
```tsx
const { clienteData, getEnderecoFormatado } = useClienteData();
```

### Componente
Arquivo: `src/routes/_authenticated/os.tsx`
- Busca dados do cliente selecionado em tempo real
- Preenche o endereço no input
- Mostra mensagem de preenchimento automático

### Banco de Dados
Campos usados da tabela `clientes`:
- `endereco`
- `numero`
- `bairro`
- `cidade`
- `estado`
- `cep`

---

## 🎓 Exemplo de Uso

**Cenário:** Cliente "João Silva" com endereço cadastrado:
- Rua: Avenida Paulista
- Número: 1000
- Bairro: Bela Vista
- Cidade: São Paulo
- Estado: SP
- CEP: 01311-100

**Resultado no campo de O.S.:**
```
Endereço de atendimento: Avenida Paulista, 1000, Bela Vista, São Paulo, SP, 01311-100
```

---

## 🚀 Próximas Melhorias Opcionais

- [ ] Botão "Copiar para Endereço Alternativo"
- [ ] Histórico de endereços visitados
- [ ] Integração com Google Maps
- [ ] Sugestões de rotas
- [ ] Preenchimento automático de telefone/email também

---

Pronto! Teste clicando em "Nova OS" e selecionando um cliente! 🎉
