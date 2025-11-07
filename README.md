# StackSpot SDK (beta)

**Contato**: [LinkedIn](https://www.linkedin.com/in/iago-delsuc-1b53241b0) • [Instagram](https://www.instagram.com/iagogalldino)

SDK em TypeScript inspirado na API da OpenAI para integrar com a StackSpot GenAI API. Inclui helpers para criar threads, mensagens, executar agentes e orquestrar exemplos multiagentes.

![StackSpot banner](docs/stackspot.jpg)

## Requisitos

- Node.js **18** ou superior (utilizado para `AbortSignal.timeout`).
- Conta StackSpot criada no [portal StackSpot](https://ai.stackspot.com/?campaignCode=01K8TQ5N0KJYQHJ01FYGP3WR53) para obter credenciais e agentes disponíveis.

## Instalação

```bash
npm install @stackspot/sdk
```

## Configuração de ambiente

Antes de usar os exemplos ou consumir o SDK, informe suas credenciais através de variáveis de ambiente:

| Variável | Descrição |
| --- | --- |
| `STACKSPOT_CLIENT_ID` | Client ID gerado no portal StackSpot |
| `STACKSPOT_CLIENT_SECRET` | Client Secret correspondente |
| `STACKSPOT_AGENT_ID` | ID do agente (assistente) que será executado |
| `STACKSPOT_REALM` *(opcional)* | Realm/tenant do seu workspace. Padrão: `stackspot-freemium` |

Exemplo no Linux/macOS:

```bash
export STACKSPOT_CLIENT_ID="seu-client-id"
export STACKSPOT_CLIENT_SECRET="seu-client-secret"
export STACKSPOT_AGENT_ID="01KXXXXXXXXXXXXXXX"
```

No Windows PowerShell:

```powershell
$env:STACKSPOT_CLIENT_ID="seu-client-id"
$env:STACKSPOT_CLIENT_SECRET="seu-client-secret"
$env:STACKSPOT_AGENT_ID="01KXXXXXXXXXXXXXXX"
```

## Uso básico

```ts
import StackSpot from '@stackspot/sdk';

const stackspot = new StackSpot({
  clientId: process.env.STACKSPOT_CLIENT_ID!,
  clientSecret: process.env.STACKSPOT_CLIENT_SECRET!,
  realm: process.env.STACKSPOT_REALM || 'stackspot-freemium',
});

async function executar() {
  const thread = await stackspot.beta.threads.create();

  await stackspot.beta.threads.messages.create(thread.id, {
    role: 'user',
    content: 'Olá! Pode me ajudar?',
  });

  const run = await stackspot.beta.threads.runs.create(thread.id, {
    assistant_id: process.env.STACKSPOT_AGENT_ID!,
  });

  // Consulte o status até finalizar
  let status = run.status;
  while (status === 'queued' || status === 'in_progress') {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    status = (await stackspot.beta.threads.runs.retrieve(thread.id, run.id)).status;
  }

  const messages = await stackspot.beta.threads.messages.list(thread.id, { order: 'asc' });
  const resposta = messages.data[messages.data.length - 1];
  console.log(resposta.content[0].text.value);
}

executar().catch(console.error);
```

## APIs disponíveis

A interface `stackspot.beta` é dividida em namespaces compatíveis com o SDK da OpenAI. Abaixo um resumo dos principais métodos e como usá-los no dia a dia.

### `assistants`

- `list(params?)` – retorna os agentes configurados no seu workspace. Útil para descobrir IDs.
- `retrieve(assistantId)` – busca detalhes de um agente específico.
- `create/update/del` – existem apenas para compatibilidade; no momento os agentes devem ser gerenciados via portal StackSpot.

```ts
const agentes = await stackspot.beta.assistants.list();
console.log(agentes.data.map((agente) => agente.name));
```

### `threads`

- `create({ messages? })` – abre uma nova conversa. Você pode opcionalmente enviar mensagens iniciais.
- `retrieve(threadId)` – obtém metadados da thread.
- `update(threadId, metadata)` – anexa metadados customizados.
- `del(threadId)` – remove a thread e histórico local.

```ts
const thread = await stackspot.beta.threads.create({
  messages: [{ role: 'user', content: 'Quero gerar um relatório.' }],
});
```

#### `threads.messages`

- `create(threadId, { role, content })` – adiciona mensagens do usuário ou do sistema.
- `list(threadId, { order })` – lê o histórico; `order: 'asc'` retorna do mais antigo para o mais recente.

```ts
await stackspot.beta.threads.messages.create(thread.id, {
  role: 'user',
  content: 'Liste os três principais tópicos.'
});

const historico = await stackspot.beta.threads.messages.list(thread.id, { order: 'asc' });
```

#### `threads.runs`

- `create(threadId, { assistant_id, stream?, instructions?, tools? })` – dispara a execução do agente para a thread.
- `retrieve(threadId, runId)` – acompanha o status (`queued`, `in_progress`, `completed`, `failed`).
- `list(threadId, { limit, order })` – historiza execuções.
- `cancel(threadId, runId)` – tenta cancelar um run pendente.
- `submitToolOutputs(threadId, runId, { tool_outputs })` – compatibilidade para cenários onde o agente exige intervenção humana.

```ts
const run = await stackspot.beta.threads.runs.create(thread.id, {
  assistant_id: process.env.STACKSPOT_AGENT_ID!,
});

let status = run.status;
while (status === 'queued' || status === 'in_progress') {
  await new Promise((r) => setTimeout(r, 1000));
  status = (await stackspot.beta.threads.runs.retrieve(thread.id, run.id)).status;
}
```

### Utilitários

- `FileStorage` – implementação padrão de armazenamento local (JSON). Você pode injetar outra estratégia se desejar.
- `functionCallParser` – helpers para detectar e executar function calling nos exemplos multiagentes.

## Exemplos incluídos

- `examples/basic-usage.ts` – fluxo de conversa básico com polling.
- `examples/create-simple-page.ts` – orquestra múltiplos agentes para gerar e abrir um `index.html` com efeito de estrelas.
- `examples/open-chrome-command.ts` – demonstra o uso de ferramentas (`execute_command`) para abrir o Chrome em uma URL específica.

Execute qualquer exemplo após configurar as variáveis de ambiente:

```bash
npm run example:basic
npm run example:create-page
npm run example:open-chrome
```

## Desenvolvimento

- `npm run build` – compila os arquivos TypeScript para `dist/`.
- `npm run prepublishOnly` – script executado automaticamente antes do `npm publish`.
- `npm pack --dry-run` – visualize os arquivos que serão publicados.
- `npm run test` – executa a suíte de testes unitários com Vitest.

Os artefatos publicados são limitados aos diretórios `dist/`, `README.md` e `LICENSE` (veja a propriedade `files` em `package.json`).

## Licença

Distribuído sob a licença ISC. Consulte o arquivo `LICENSE` para detalhes.


