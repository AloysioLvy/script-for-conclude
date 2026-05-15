import { chromium } from 'playwright';
import path from 'node:path';
import readline from 'node:readline';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const URL_ALVO = process.env.URL || 'https://estudante.wyden.com.br/inicio';
const HEADLESS = process.env.HEADLESS === 'true';
const MAX_TEMAS = Number(process.env.MAX_TEMAS || 99);
const MAX_DISCIPLINAS = Number(process.env.MAX_DISCIPLINAS || 99);
const MAX_TENTATIVAS = Number(process.env.MAX_TENTATIVAS || 30);

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitForEnter(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(message, () => { rl.close(); resolve(); }));
}

async function clicarMostrarMais(page) {
  const btn = page.locator('button[aria-label="Mostrar mais"]');
  while (await btn.count() > 0 && await btn.first().isVisible()) {
    console.log('       expandindo lista de temas...');
    await btn.first().click().catch(() => {});
    await page.waitForTimeout(1500);
  }
}

async function pegarProximoTemaPendente(page) {
  await clicarMostrarMais(page);
  const cards = page.locator('section[data-testid="card-sucesso"]').filter({
    has: page.locator('div[data-testid="card-tag"][aria-label="Pendente"]'),
  });
  const count = await cards.count();
  if (count === 0) return null;
  const card = cards.first();
  const titulo = (await card.locator('h3[data-testid="card-sucesso-titulo"]').textContent())?.trim() ?? '(sem título)';
  return { card, titulo };
}

async function processarTema(page, indice) {
  const proximo = await pegarProximoTemaPendente(page);
  if (!proximo) return false;

  console.log(`\n  [Tema ${indice}] ${proximo.titulo}`);
  console.log('       abrindo o tema...');
  await proximo.card.locator('button[data-testid="card-sucesso-botao"]').click();
  await page.waitForTimeout(2500);

  const drawerBtn = page.locator('section[role="dialog"][aria-hidden="false"] button[data-testid="botao-card-conteudo-drawer"]');
  if (await drawerBtn.count() > 0 && await drawerBtn.first().isVisible()) {
    console.log('       drawer detectado, entrando no conteúdo...');
    await drawerBtn.first().click();
    await page.waitForTimeout(2500);
  }

  const btnConcluir = page.locator('button[data-element="button_marcar-como-concluido"]');
  await btnConcluir.waitFor({ state: 'visible', timeout: 30000 });

  console.log(`       checando "Marcar como concluído" a cada 1 min (limite ${MAX_TENTATIVAS} min)...`);
  let clicou = false;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    const disabled = await btnConcluir.getAttribute('disabled');
    const ariaDisabled = await btnConcluir.getAttribute('aria-disabled');
    const habilitado = disabled === null && ariaDisabled !== 'true';
    const label = (await btnConcluir.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
    const ts = new Date().toLocaleTimeString('pt-BR');
    console.log(`       [${ts}] tentativa ${tentativa}/${MAX_TENTATIVAS} — ${habilitado ? 'HABILITADO' : 'desabilitado'} — "${label}"`);
    if (habilitado) {
      await btnConcluir.click();
      clicou = true;
      break;
    }
    await page.waitForTimeout(60 * 1000);
  }
  if (!clicou) throw new Error(`Botão "Marcar como concluído" não habilitou em ${MAX_TENTATIVAS} minutos.`);
  await page.waitForTimeout(3000);

  console.log('       voltando para a lista de temas...');
  const btnVoltarConteudo = page.locator('button[data-testid="btn-voltar"]').first();
  if (await btnVoltarConteudo.count() > 0) {
    await btnVoltarConteudo.click();
  } else {
    await page.goBack();
  }
  await page.waitForTimeout(3000);
  return true;
}

async function estaNaHome(page) {
  return (await page.locator('[data-testid="container-home"]').count()) > 0;
}

async function voltarParaHome(page) {
  for (let i = 0; i < 4; i++) {
    if (await estaNaHome(page)) return;
    const voltar = page.locator(
      'button[data-testid="btn-icon-with-hyperlink"], button[data-testid="btn-voltar"]'
    ).first();
    if (await voltar.count() === 0) break;
    console.log('       clicando em Voltar...');
    await voltar.click().catch(() => {});
    await page.waitForTimeout(2500);
  }
  if (!(await estaNaHome(page))) {
    console.log('       forçando ida pra home via URL...');
    await page.goto(URL_ALVO, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  }
}

async function listarDisciplinas(page) {
  await page.waitForSelector('[data-testid="card-disciplina"]', { timeout: 20000 });
  // Avança o carrossel até não aparecer mais título novo
  const titulos = new Set();
  for (let tentativa = 0; tentativa < 10; tentativa++) {
    const elems = await page.locator('[data-testid="card-disciplina-titulo"]').all();
    const antes = titulos.size;
    for (const el of elems) {
      const t = (await el.textContent())?.trim();
      if (t) titulos.add(t);
    }
    const avancar = page.locator('button[data-element="button_avancar-carrossel"]').first();
    if (await avancar.count() === 0) break;
    const disabled = await avancar.getAttribute('disabled');
    if (disabled !== null) break;
    if (titulos.size === antes && tentativa > 0) break;
    await avancar.click().catch(() => {});
    await page.waitForTimeout(1000);
  }
  return [...titulos];
}

async function entrarNaDisciplina(page, titulo) {
  const card = page.locator('[data-testid="card-disciplina"]').filter({
    has: page.locator(`[data-testid="card-disciplina-titulo"]:has-text(${JSON.stringify(titulo)})`),
  }).first();

  // Pode estar fora da viewport do carrossel; avança até ficar visível
  for (let i = 0; i < 10; i++) {
    if (await card.isVisible().catch(() => false)) break;
    const avancar = page.locator('button[data-element="button_avancar-carrossel"]').first();
    if (await avancar.count() === 0) break;
    await avancar.click().catch(() => {});
    await page.waitForTimeout(800);
  }
  await card.scrollIntoViewIfNeeded().catch(() => {});
  await card.locator('button[data-testid="card-disciplina-botao-acessar"]').click();
  await page.waitForTimeout(3500);
}

async function processarDisciplina(page, nome) {
  console.log(`\n=== Disciplina: ${nome} ===`);
  for (let i = 1; i <= MAX_TEMAS; i++) {
    const seguiu = await processarTema(page, i);
    if (!seguiu) {
      console.log('       sem mais temas pendentes nessa disciplina.');
      break;
    }
  }
  console.log('       voltando pra home...');
  await voltarParaHome(page);
}

async function main() {
  const userDataDir = path.join(__dirname, '.browser-data');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: HEADLESS,
    viewport: null,
    args: ['--start-maximized'],
  });
  const page = context.pages()[0] || await context.newPage();

  console.log(`[1] Abrindo ${URL_ALVO}`);
  await page.goto(URL_ALVO, { waitUntil: 'domcontentloaded' });

  console.log('[2] Faça login (se necessário) e fique na tela inicial (a com os cards "Disciplinas").');
  await waitForEnter('    Quando estiver pronto, pressione ENTER aqui... ');

  const todas = await listarDisciplinas(page);
  console.log(`\n[3] Encontradas ${todas.length} disciplinas: ${todas.join(' | ')}`);

  const concluidas = new Set();
  let processadas = 0;
  for (const titulo of todas) {
    if (processadas >= MAX_DISCIPLINAS) break;
    if (concluidas.has(titulo)) continue;

    if (!(await estaNaHome(page))) await voltarParaHome(page);
    await entrarNaDisciplina(page, titulo);
    await processarDisciplina(page, titulo);
    concluidas.add(titulo);
    processadas++;
  }

  console.log(`\nFim. ${processadas} disciplina(s) processada(s). Fechando em 10s.`);
  await sleep(10000);
  await context.close();
}

main().catch(async (err) => {
  console.error('\nErro:', err.message);
  process.exit(1);
});
