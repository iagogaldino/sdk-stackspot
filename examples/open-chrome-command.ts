/**
 * Exemplo demonstrando como permitir que um agente execute um comando local
 * para abrir o Google Chrome diretamente no site https://ai.stackspot.com/.
 *
 * ⚠️ Atenção: executar comandos enviados pelo agente pode ser perigoso.
 * Restrinja os comandos aceitos e utilize apenas em ambiente controlado.
 */

import StackSpot from '../src';
import { ToolExecutor, Message } from '../src/types';
import { promisify } from 'node:util';
import { exec } from 'node:child_process';

const execAsync = promisify(exec);
const TARGET_URL = 'https://ai.stackspot.com/';

function buildDefaultCommand(): string {
  if (process.platform === 'win32') {
    return `start "" "chrome" "${TARGET_URL}"`;
  }

  if (process.platform === 'darwin') {
    return `open -a "Google Chrome" "${TARGET_URL}"`;
  }

  return `xdg-open "${TARGET_URL}"`;
}

const commandWhitelist = [
  `start "" "chrome" "${TARGET_URL}"`,
  `start "" chrome "${TARGET_URL}"`,
  `start chrome "${TARGET_URL}"`,
  `open -a "Google Chrome" "${TARGET_URL}"`,
  `open -a Google\ Chrome "${TARGET_URL}"`,
  `xdg-open "${TARGET_URL}"`,
  `google-chrome "${TARGET_URL}"`,
  `google-chrome ${TARGET_URL}`,
  `chromium-browser "${TARGET_URL}"`,
  `chromium-browser ${TARGET_URL}`,
];

const toolExecutor: ToolExecutor = async (functionName, args) => {
  if (functionName !== 'execute_command') {
    return `Erro: função ${functionName} não suportada neste exemplo.`;
  }

  const rawCommand = typeof args.command === 'string' ? args.command.trim() : '';
  const commandToRun = rawCommand || buildDefaultCommand();

  if (!commandWhitelist.includes(commandToRun)) {
    console.warn(`⚠️ Comando rejeitado pelo whitelist: ${commandToRun}`);
    return 'Erro: comando não autorizado para execução local.';
  }

  console.log(`🔧 Executando comando local: ${commandToRun}`);

  try {
    await execAsync(commandToRun, {
      windowsHide: true,
    });
    return 'Chrome aberto com sucesso no site solicitado.';
  } catch (error: any) {
    console.error('❌ Erro ao executar comando local:', error);
    return `Erro: ${error.message || 'Falha desconhecida ao executar o comando.'}`;
  }
};

function requireEnv(varName: string): string {
  const value = process.env[varName];
  if (!value) {
    throw new Error(`Variável de ambiente ${varName} não definida.`);
  }
  return value;
}

/**
 * Pré-requisitos:
 * - Configure STACKSPOT_CLIENT_ID, STACKSPOT_CLIENT_SECRET e STACKSPOT_AGENT_ID no ambiente
 * - Opcional: defina STACKSPOT_REALM conforme seu workspace do StackSpot
 */

async function abrirChromeComAgente() {
  const stackspot = new StackSpot({
    clientId: requireEnv('STACKSPOT_CLIENT_ID'),
    clientSecret: requireEnv('STACKSPOT_CLIENT_SECRET'),
    realm: process.env.STACKSPOT_REALM || 'stackspot-freemium',
    toolExecutor,
    enableFunctionCalling: true,
  });

  console.log('✅ Cliente StackSpot inicializado com suporte a execute_command\n');

  const thread = await stackspot.beta.threads.create();
  console.log(`🧵 Thread criada: ${thread.id}`);

  await stackspot.beta.threads.messages.create(thread.id, {
    role: 'system',
    content: [
      'Você é responsável por executar comandos locais usando a ferramenta execute_command.',
      'Siga estritamente as regras abaixo:',
      '1. O usuário está em um ambiente Windows 10.',
      '2. Para abrir o Chrome em https://ai.stackspot.com/, responda **somente** com:',
      '   execute_command command=start "" "chrome" "https://ai.stackspot.com/"',
      '3. Não inclua texto adicional, não use Markdown e não faça perguntas.',
    ].join('\n'),
  });

  await stackspot.beta.threads.messages.create(thread.id, {
    role: 'user',
    content:
      'Abra o Google Chrome apontando para https://ai.stackspot.com/. '
      + 'Use o execute_command conforme instruído, no formato exato informado.',
  });

  const assistantId = requireEnv('STACKSPOT_AGENT_ID');
  console.log(`🤖 Executando agente ${assistantId}...`);

  const run = await stackspot.beta.threads.runs.create(thread.id, {
    assistant_id: assistantId,
    stream: false,
  });

  let currentRun = run;
  let attempts = 0;
  const maxAttempts = 30;

  while (
    (currentRun.status === 'queued' || currentRun.status === 'in_progress') &&
    attempts < maxAttempts
  ) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    currentRun = await stackspot.beta.threads.runs.retrieve(thread.id, run.id);
    attempts++;
    console.log(`   Status do run: ${currentRun.status} (${attempts}/${maxAttempts})`);
  }

  if (currentRun.status === 'failed') {
    console.error(`❌ O agente retornou erro: ${currentRun.last_error?.message}`);
    return;
  }

  if (currentRun.status !== 'completed') {
    console.warn('⚠️ O agente não finalizou dentro do tempo limite.');
    return;
  }

  console.log('✅ Run concluído. Verificando histórico da conversa...');

  const messages = await stackspot.beta.threads.messages.list(thread.id, { order: 'asc' });
  const lastAssistantMessage = messages.data
    .filter((msg: Message) => msg.role === 'assistant')
    .pop();

  if (lastAssistantMessage) {
    console.log('\n🗨️ Resposta do agente:\n');
    console.log(lastAssistantMessage.content[0].text.value);
  }

  console.log('\nSe tudo correu bem, o Chrome deve ter sido aberto apontando para o site alvo.');
}

abrirChromeComAgente().catch((error) => {
  console.error('❌ Erro no exemplo:', error);
  process.exit(1);
});


