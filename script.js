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

// ─── output ────────────────────────────────────────────────────────────────
const USE_COLOR = process.stdout.isTTY && process.env.NO_COLOR !== '1';
const c = (code) => (s) => (USE_COLOR ? `\x1b[${code}m${s}\x1b[0m` : s);
const bold = c('1');
const dim = c('2');
const red = c('31');
const green = c('32');
const yellow = c('33');
const blue = c('36');
const magenta = c('35');

const log = {
  info: (msg) => console.log(`${blue('ℹ')}  ${msg}`),
  step: (msg) => console.log(`${dim('   →')} ${dim(msg)}`),
  wait: (msg) => console.log(`${yellow('⏳')} ${msg}`),
  ok: (msg) => console.log(`${green('✓')}  ${msg}`),
  warn: (msg) => console.log(`${yellow('!')}  ${msg}`),
  err: (msg) => console.log(`${red('✗')}  ${msg}`),
  divider: () => console.log(dim('───────────────────────────────────────────────')),
  banner: (title, subtitle) => {
    const line = '═'.repeat(50);
    console.log('\n' + magenta(line));
    console.log('  ' + bold(magenta(title)));
    if (subtitle) console.log('  ' + dim(subtitle));
    console.log(magenta(line) + '\n');
  },
  section: (msg) => console.log('\n' + bold(magenta('▸ ' + msg))),
};

const fmtHM = (segundos) => {
  const h = Math.floor(segundos / 3600);
  const m = Math.floor((segundos % 3600) / 60);
  const s = segundos % 60;
  if (h > 0) return `${h}h ${m}min`;
  if (m > 0) return `${m}min ${s}s`;
  return `${s}s`;
};

// ─── helpers ───────────────────────────────────────────────────────────────
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function waitForEnter(message) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise((resolve) => rl.question(message, () => { rl.close(); resolve(); }));
}

async function clicarMostrarMais(page) {
  const btn = page.locator('button[aria-label="Mostrar mais"]');
  while (await btn.count() > 0 && await btn.first().isVisible()) {
    log.step('expandindo lista de temas');
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

  console.log(`\n  ${bold(`Tema ${indice}:`)} ${proximo.titulo}`);
  log.step('abrindo o tema');
  await proximo.card.locator('button[data-testid="card-sucesso-botao"]').click();
  await page.waitForTimeout(2500);

  const drawerBtn = page.locator('section[role="dialog"][aria-hidden="false"] button[data-testid="botao-card-conteudo-drawer"]');
  if (await drawerBtn.count() > 0 && await drawerBtn.first().isVisible()) {
    log.step('entrando no conteúdo via drawer');
    await drawerBtn.first().click();
    await page.waitForTimeout(2500);
  }

  const btnConcluir = page.locator('button[data-element="button_marcar-como-concluido"]');
  await btnConcluir.waitFor({ state: 'visible', timeout: 30000 });

  log.wait(`aguardando o botão "Marcar como concluído" habilitar (checa de 1 em 1 min, até ${MAX_TENTATIVAS} min)`);
  let clicou = false;
  for (let tentativa = 1; tentativa <= MAX_TENTATIVAS; tentativa++) {
    const disabled = await btnConcluir.getAttribute('disabled');
    const ariaDisabled = await btnConcluir.getAttribute('aria-disabled');
    const habilitado = disabled === null && ariaDisabled !== 'true';
    const label = (await btnConcluir.textContent())?.replace(/\s+/g, ' ').trim() ?? '';
    const ts = new Date().toLocaleTimeString('pt-BR');
    const status = habilitado ? green('liberado') : yellow('aguardando');
    console.log(`   ${dim(`[${ts}]`)} ${status} ${dim(`(${tentativa}/${MAX_TENTATIVAS})`)}  ${dim(label)}`);
    if (habilitado) {
      await btnConcluir.click();
      clicou = true;
      break;
    }
    await page.waitForTimeout(60 * 1000);
  }
  if (!clicou) throw new Error(`Botão "Marcar como concluído" não habilitou em ${MAX_TENTATIVAS} minutos.`);
  log.ok(`tema concluído: ${proximo.titulo}`);
  await page.waitForTimeout(3000);

  log.step('voltando pra lista de temas');
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
    log.step('clicando em Voltar');
    await voltar.click().catch(() => {});
    await page.waitForTimeout(2500);
  }
  if (!(await estaNaHome(page))) {
    log.step('forçando ida pra home via URL');
    await page.goto(URL_ALVO, { waitUntil: 'domcontentloaded' });
    await page.waitForTimeout(3000);
  }
}

async function listarDisciplinas(page) {
  await page.waitForSelector('[data-testid="card-disciplina"]', { timeout: 20000 });
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

async function processarDisciplina(page, nome, indice, total) {
  log.section(`Disciplina ${indice}/${total}: ${nome}`);
  let temasConcluidos = 0;
  for (let i = 1; i <= MAX_TEMAS; i++) {
    const seguiu = await processarTema(page, i);
    if (!seguiu) {
      if (temasConcluidos === 0) log.info(dim('nenhum tema pendente nessa disciplina'));
      else log.ok(`disciplina finalizada (${temasConcluidos} tema${temasConcluidos === 1 ? '' : 's'} concluído${temasConcluidos === 1 ? '' : 's'})`);
      break;
    }
    temasConcluidos++;
  }
  log.step('voltando pra home');
  await voltarParaHome(page);
  return temasConcluidos;
}

async function main() {
  const inicio = Date.now();
  log.banner('script-for-conclude', 'Automação da Sala de Aula Virtual da Wyden');

  const userDataDir = path.join(__dirname, '.browser-data');
  const context = await chromium.launchPersistentContext(userDataDir, {
    headless: HEADLESS,
    viewport: null,
    args: ['--start-maximized'],
  });
  const page = context.pages()[0] || await context.newPage();

  log.info(`abrindo ${blue(URL_ALVO)}`);
  await page.goto(URL_ALVO, { waitUntil: 'domcontentloaded' });

  log.info('faça login (se necessário) e vá até a tela inicial com a lista de Disciplinas');
  await waitForEnter(`   ${dim('quando estiver pronto, pressione ENTER aqui... ')}`);

  const todas = await listarDisciplinas(page);
  if (todas.length === 0) {
    log.warn('nenhuma disciplina encontrada na home — verifique se está na tela certa');
    await context.close();
    return;
  }
  log.ok(`${todas.length} disciplina${todas.length === 1 ? '' : 's'} encontrada${todas.length === 1 ? '' : 's'}:`);
  todas.forEach((t, i) => console.log(`   ${dim((i + 1).toString().padStart(2) + '.')} ${t}`));

  const concluidas = new Set();
  let processadas = 0;
  let temasTotais = 0;
  const aProcessar = Math.min(todas.length, MAX_DISCIPLINAS);

  for (const titulo of todas) {
    if (processadas >= MAX_DISCIPLINAS) break;
    if (concluidas.has(titulo)) continue;

    if (!(await estaNaHome(page))) await voltarParaHome(page);
    await entrarNaDisciplina(page, titulo);
    const temas = await processarDisciplina(page, titulo, processadas + 1, aProcessar);
    temasTotais += temas;
    concluidas.add(titulo);
    processadas++;
  }

  const duracaoSeg = Math.floor((Date.now() - inicio) / 1000);
  log.banner('Resumo', `tempo total: ${fmtHM(duracaoSeg)}`);
  console.log(`   ${green('✓')} ${bold(processadas)} disciplina${processadas === 1 ? '' : 's'} processada${processadas === 1 ? '' : 's'}`);
  console.log(`   ${green('✓')} ${bold(temasTotais)} tema${temasTotais === 1 ? '' : 's'} concluído${temasTotais === 1 ? '' : 's'}`);
  console.log(dim('\n   fechando o navegador em 10s... (Ctrl+C pra sair antes)\n'));
  await sleep(10000);
  await context.close();
}

main().catch(async (err) => {
  console.log();
  log.err(`erro: ${err.message}`);
  process.exit(1);
});
