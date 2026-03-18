# QA Multi-Tenant

Este documento define o roteiro oficial de validacao do isolamento multi-tenant do `G7 Client Connector`.

## Objetivo

Validar que:

- cada empresa opera em seu proprio `workspace_id`;
- dados de uma empresa nao aparecem para outra;
- webhooks e envios de WhatsApp sao roteados pelo workspace correto;
- mensagens, conversas, tickets e protocolos ficam gravados com o `workspace_id` esperado.

## Pre-requisitos

- Ambiente apontando para o projeto Supabase correto.
- Migrations de workspace aplicadas.
- Build e TypeScript verdes.
- Acesso ao painel/app e ao banco.
- Postman ou Insomnia.
- Uma configuracao de Z-API para o workspace de teste, ou dados mock coerentes.

## Contas de teste

- Empresa A
  - Usuario: `tony@stark.com`
  - Empresa: `Stark Industries`
- Empresa B
  - Usuario: `bruce@wayne.com`
  - Empresa: `Wayne Enterprises`

## Resultado esperado final

- Stark ve apenas dados da Stark.
- Wayne ve apenas dados da Wayne.
- Webhook da Stark cria dados no workspace da Stark.
- Wayne nao recebe nenhum reflexo visual nem dado persistido do webhook da Stark.

## Etapa 1: Criacao dos workspaces

1. Abrir o app no ambiente de teste.
2. Criar a conta `tony@stark.com` com empresa `Stark Industries`.
3. Em aba anonima, criar `bruce@wayne.com` com empresa `Wayne Enterprises`.
4. Confirmar que ambos conseguem autenticar.

### Validacao SQL

```sql
select id, name, slug
from public.workspaces
order by created_at desc;
```

Esperado:

- dois workspaces distintos;
- um para `Stark Industries`;
- um para `Wayne Enterprises`.

```sql
select tm.user_id, tm.tenant_id as workspace_id, t.name, tm.role, tm.is_active
from public.tenant_members tm
join public.tenants t on t.id = tm.tenant_id
order by tm.created_at desc;
```

Esperado:

- Tony vinculado ao workspace Stark;
- Bruce vinculado ao workspace Wayne;
- ambos ativos.

## Etapa 2: Isolamento de interface

### Como Tony

1. Logar como Tony.
2. Ir para `SAC`.
3. Criar um ticket com titulo parecido com `Armadura com defeito`.
4. Ir para `Agenda` e, se desejar, criar um evento de teste.
5. Abrir `Inbox` e confirmar que nao ha nada da Wayne.

### Como Bruce

1. Na aba anonima, logar como Bruce.
2. Abrir `SAC`.
3. Abrir `Agenda`.
4. Abrir `Inbox`.

Esperado:

- Bruce nao pode ver o ticket da Stark;
- Bruce nao pode ver eventos da Stark;
- Bruce nao pode ver conversas da Stark.

## Etapa 3: Configuracao Z-API da Stark

### Pela interface

1. Logado como Tony, abrir `Integracoes`.
2. Configurar a Z-API da Stark com um identificador exclusivo, por exemplo:
   - `zapi_instance_id`: `stark-test-instance`
3. Salvar a configuracao.

### Validacao SQL

```sql
select id, workspace_id, zapi_instance_id, zapi_token, zapi_security_token
from public.zapi_settings
where zapi_instance_id = 'stark-test-instance';
```

Esperado:

- o registro pertence ao `workspace_id` da Stark.

## Etapa 4: Simulacao de webhook da Z-API

### Endpoint

`POST https://SEU_SUPABASE_PROJECT.supabase.co/functions/v1/zapi-webhook`

### Headers

```text
Content-Type: application/json
Authorization: Bearer SEU_SUPABASE_SERVICE_ROLE_KEY
apikey: SEU_SUPABASE_SERVICE_ROLE_KEY
```

### Payload

```json
{
  "instanceId": "stark-test-instance",
  "messageId": "msg-stark-001",
  "fromMe": false,
  "isGroup": false,
  "chatLid": "5511999991111@c.us",
  "chatId": "5511999991111@c.us",
  "senderPhone": "5511999991111",
  "senderName": "Tony Cliente",
  "pushName": "Tony Cliente",
  "text": {
    "message": "Ola, gostaria de comprar um reator Arc"
  },
  "type": "text"
}
```

### Resultado esperado HTTP

- resposta `200`;
- corpo com `success: true` ou equivalente.

## Etapa 5: Validacao do banco apos webhook

### Conversas

```sql
select id, workspace_id, chat_id, contact_id, last_message_at
from public.conversations
order by last_message_at desc
limit 10;
```

### Contatos

```sql
select id, workspace_id, chat_lid, name, is_group
from public.contacts
order by updated_at desc
limit 10;
```

### Mensagens

```sql
select id, workspace_id, conversation_id, provider, direction, content, sent_at
from public.messages
order by sent_at desc
limit 10;
```

Esperado:

- os tres registros novos usam o `workspace_id` da Stark;
- `provider = 'zapi'` na mensagem;
- nenhum registro novo no workspace da Wayne.

## Etapa 6: Validacao visual apos webhook

### Como Tony

1. Abrir `Inbox`.
2. Localizar a conversa do numero `5511999991111`.
3. Confirmar que a mensagem `Ola, gostaria de comprar um reator Arc` aparece.

### Como Bruce

1. Abrir `Inbox`.
2. Confirmar que a conversa da Stark nao aparece.
3. Confirmar ausencia de notificacao e ausencia de mensagem.

## Etapa 7: Validacao de outbound

### Como Tony

1. Abrir a conversa criada pelo webhook.
2. Enviar uma resposta manual pelo app.

### Validacao SQL

```sql
select id, workspace_id, conversation_id, provider, direction, content, sent_at
from public.messages
where conversation_id = 'COLE_A_CONVERSATION_ID_AQUI'
order by sent_at desc;
```

Esperado:

- a resposta sai com `direction = 'outbound'`;
- continua no `workspace_id` da Stark.

## Etapa 8: Criterios de aprovacao

Marcar todos como `OK`:

- [ ] Dois workspaces distintos criados.
- [ ] Usuarios vinculados ao workspace correto.
- [ ] Stark nao enxerga dados da Wayne.
- [ ] Wayne nao enxerga dados da Stark.
- [ ] Z-API da Stark salva configuracao no workspace correto.
- [ ] Webhook cria contato com `workspace_id` da Stark.
- [ ] Webhook cria conversa com `workspace_id` da Stark.
- [ ] Webhook cria mensagem com `workspace_id` da Stark.
- [ ] Inbox da Stark exibe a conversa recebida.
- [ ] Inbox da Wayne continua limpa.
- [ ] Resposta outbound da Stark permanece no workspace correto.

## Falhas comuns

- A mensagem chega no provedor, mas nao aparece na tela.
  - Verificar `workspace_id` em `contacts`, `conversations` e `messages`.
- O webhook responde `200`, mas nao grava nada.
  - Verificar se `instanceId` bate com `zapi_settings.zapi_instance_id`.
- Wayne ve conversa da Stark.
  - Revisar RLS e memberships.
- A interface nao mostra a conversa, mas o banco mostra.
  - Revisar realtime, filtros por workspace e cache local.

## Observacoes

- O fallback de credenciais globais da Z-API pode existir para operacao gerenciada, mas o teste oficial deve preferir configuracao por workspace.
- Se for testar arquivos ou audios, validar tambem o caminho do storage no formato:
  - `workspace_id/conversation_id/tipo/arquivo`
