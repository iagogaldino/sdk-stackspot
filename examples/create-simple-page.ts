/**
 * Agentes envolvidos neste fluxo:
 * 1. Orquestrador: coordena a execução e delega tarefas.
 * 2. Especialista em HTML/CSS: implementa o layout solicitado.
 * 3. Validador de código: garante que o HTML entregável esteja correto.
 * 4. Especialista em comandos Windows: abre a página gerada no navegador.
 *
 * Pré-requisitos:
 * - Defina as variáveis de ambiente STACKSPOT_CLIENT_ID, STACKSPOT_CLIENT_SECRET e STACKSPOT_AGENT_ID
 * - Opcionalmente ajuste STACKSPOT_REALM conforme seu workspace
 */

import StackSpot from '../src';
import { mkdir, writeFile } from 'fs/promises';
import path from 'path';
import { spawn } from 'child_process';

function requireEnv(varName: string): string {
  const value = process.env[varName];
  if (!value) {
    throw new Error(`Variável de ambiente ${varName} não definida.`);
  }
  return value;
}

async function criarPaginaHtml() {
  // Instancia o cliente StackSpot com credenciais válidas para os agentes
  const stackspot = new StackSpot({
    clientId: requireEnv('STACKSPOT_CLIENT_ID'),
    clientSecret: requireEnv('STACKSPOT_CLIENT_SECRET'),
    realm: process.env.STACKSPOT_REALM || 'stackspot-freemium',
  });

  console.log('✅ Cliente StackSpot pronto');

  const agentes = [
    { nome: 'Orquestrador', objetivo: 'Coordenar o fluxo e delegar tarefas.' },
    { nome: 'Especialista HTML/CSS', objetivo: 'Construir o layout solicitado.' },
    { nome: 'Validador de código', objetivo: 'Garantir que o HTML final esteja correto.' },
    { nome: 'Especialista Windows', objetivo: 'Executar comandos para abrir o arquivo gerado.' },
  ];

  console.log('👥 Agentes envolvidos:');
  agentes.forEach((agente, indice) => {
    console.log(`   ${indice + 1}. ${agente.nome}: ${agente.objetivo}`);
  });

  // ID do agente orquestrador responsável por chamar os especialistas
  const agentId = requireEnv('STACKSPOT_AGENT_ID');

  console.log('🧵 Criando thread com instrução simples...');
  // Cria uma thread inicial contendo a instrução de orquestração para os agentes
  const thread = await stackspot.beta.threads.create({
    messages: [
      {
        role: 'user',
        content:
          'Você é um orquestrador que trabalha com quatro agentes: um especialista em HTML/CSS, um validador de código, um especialista em comandos Windows e você mesmo. Delegue para gerar um index.html com o texto "StackSpot" centralizado, fundo preto e um efeito simples animado de estrelas em CSS. Valide antes de finalizar. Depois que o arquivo estiver pronto, peça ao especialista em comandos Windows para abrir o index.html no navegador padrão. Entregue apenas HTML válido, sem markdown.',
      },
    ],
  });

  console.log('🚀 Disparando run do agente...');
  // Gera uma execução (run) que vai processar a instrução na thread
  let run = await stackspot.beta.threads.runs.create(thread.id, {
    assistant_id: agentId,
  });

  let tentativas = 0;
  const maxTentativas = 60;
  // Loop de polling simples para saber quando o run terminou
  while ((run.status === 'queued' || run.status === 'in_progress') && tentativas < maxTentativas) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
    run = await stackspot.beta.threads.runs.retrieve(thread.id, run.id);
    tentativas++;
    console.log(`   Status: ${run.status}`);
  }

  if (run.status !== 'completed') {
    // Se o run não completou, aborta com a mensagem do erro
    throw new Error(`Execução não concluiu: ${run.last_error?.message || run.status}`);
  }

  console.log('📨 Buscando resposta final...');
  // Busca a resposta do agente (última mensagem da thread)
  const messages = await stackspot.beta.threads.messages.list(thread.id, { order: 'desc', limit: 1 });
  const resposta = messages.data[0]?.content[0]?.text.value ?? 'Sem resposta';

  let html = resposta.trim();
  // Remove possíveis blocos markdown envolvendo o HTML
  const fencedHtml = html.match(/```html\s*([\s\S]*?)```/i);
  const fencedGeneric = html.match(/```\s*([\s\S]*?)```/);
  if (fencedHtml) {
    html = fencedHtml[1].trim();
  } else if (fencedGeneric) {
    html = fencedGeneric[1].trim();
  }

  console.log('\nHTML gerado pelo agente:\n');
  console.log(html);

  // Cria diretório de saída e grava o arquivo index.html
  const outputDir = path.join(process.cwd(), 'generated-page');
  await mkdir(outputDir, { recursive: true });
  const outputFile = path.join(outputDir, 'index.html');
  await writeFile(outputFile, html, 'utf-8');

  console.log(`\n🗂  Página salva em: ${outputFile}`);

  try {
    // Pede ao Windows para abrir o arquivo no navegador padrão
    const opener = spawn('cmd', ['/c', 'start', '', outputFile], {
      shell: true,
      detached: true,
      stdio: 'ignore',
    });
    opener.unref();
    console.log('🌌 Abrindo página gerada no navegador padrão...');
  } catch (err: any) {
    console.warn('⚠️ Não foi possível abrir automaticamente:', err.message);
  }
}

criarPaginaHtml().catch((error) => {
  console.error('❌ Erro ao executar exemplo:', error.message);
  process.exit(1);
});

