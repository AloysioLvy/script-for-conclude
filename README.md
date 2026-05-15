# script-for-conclude

Automação local para a Sala de Aula Virtual da Wyden (`estudante.wyden.com.br`).
Percorre todas as disciplinas do aluno, entra em cada tema pendente, espera o cronômetro de estudo mínimo e clica em **"Marcar como concluído"** automaticamente.

> Uso pessoal. Não suba sessão de outras pessoas, não publique fork público — o conteúdo de `.browser-data/` contém cookies de login.

## Pré-requisitos

- **Node.js 18+** (testado em 25)
- **macOS, Linux ou Windows** (qualquer sistema onde o Playwright rode)
- Conta válida na Sala de Aula Virtual

Confira a versão:
```bash
node --version
```

## Instalação

Clone o repositório e instale dependências (faz só uma vez):

```bash
git clone https://github.com/AloysioLvy/script-for-conclude.git
cd script-for-conclude
npm install
npx playwright install chromium
```

## Como usar

> **Importante:** todos os comandos (`npm start`, `npm install`, etc) precisam ser executados **de dentro da pasta do projeto** (`script-for-conclude/`). Se abrir um terminal novo, rode `cd caminho/para/script-for-conclude` antes.

```bash
cd script-for-conclude
npm start
```

O que acontece:

1. Uma janela do **Chromium** abre em `https://estudante.wyden.com.br/inicio`.
2. **Faça login** normalmente (Microsoft / SSO da faculdade). Login salva em `.browser-data/` — nas próximas execuções você não precisa logar de novo.
3. Garanta que está na **tela inicial** (a com os cards de Disciplinas).
4. Volte ao terminal e pressione **ENTER**.
5. A partir daí, o script faz sozinho:
   - Lê todas as disciplinas do carrossel da home (avança o carrossel sozinho se precisar)
   - Entra em cada disciplina, uma de cada vez
   - Dentro da disciplina, acha o próximo tema marcado como **Pendente**, abre o conteúdo
   - **Checa o botão "Marcar como concluído" a cada 1 minuto** — quando habilitar, clica
   - Volta pra lista de temas, processa o próximo pendente
   - Quando acabarem os temas da disciplina, volta pra home e passa pra próxima
6. Termina quando não houver mais disciplinas/temas pendentes (ou quando os limites configurados forem atingidos).

## Variáveis de ambiente

Todas opcionais. Passe antes de `npm start`:

| Variável          | Default                                  | O que faz                                                       |
|-------------------|------------------------------------------|-----------------------------------------------------------------|
| `URL`             | `https://estudante.wyden.com.br/inicio`  | Página inicial — só altere se a Wyden mudar o domínio           |
| `HEADLESS`        | (vazio = janela aberta)                  | `true` roda sem abrir janela visual                             |
| `MAX_DISCIPLINAS` | `99`                                     | Quantas disciplinas processar nessa execução                    |
| `MAX_TEMAS`       | `99`                                     | Quantos temas por disciplina                                    |
| `MAX_TENTATIVAS`  | `30`                                     | Tentativas de 1 em 1 min antes de desistir de um tema           |

### Teste antes de soltar pra todas

Rode com 1 disciplina e 1 tema só, pra confirmar que os seletores estão casando:

```bash
MAX_DISCIPLINAS=1 MAX_TEMAS=1 npm start
```

### Rodar sem janela (depois que já confirmou que funciona)

```bash
HEADLESS=true npm start
```

## Problemas comuns

**`net::ERR_NAME_NOT_RESOLVED`**
Você está sem internet ou o domínio mudou. Cheque a URL no navegador e passe via `URL=...`.

**Botão "Marcar como concluído" nunca habilita**
A Wyden exige 15 minutos no conteúdo. Se o script chega em `tentativa 16/30` ainda desabilitado, o cronômetro do servidor não está contando — geralmente porque o iframe do conteúdo perdeu foco ou a aba está minimizada. Deixe a janela visível e ativa.

**Login pede de novo a cada execução**
Cookies da Microsoft expiram. É só relogar — `.browser-data/` mantém pelo tempo de vida do token (normalmente alguns dias).

**Tela trava em "abrindo o tema..." sem mostrar drawer nem botão de concluir**
A página pode ter mudado os seletores (`data-testid`). Abra o DevTools, inspecione o botão atual e atualize o seletor correspondente em `script.js`.

## Estrutura

```
script-for-conclude/
├── script.js              # Toda a lógica de automação
├── package.json
├── README.md
├── .gitignore             # ignora .browser-data e node_modules
└── .browser-data/         # criado no 1º run, guarda sessão do Chromium (NÃO commitar)
```

## Como parar no meio da execução

`Ctrl+C` no terminal. Na próxima execução ele recomeça do tema pendente mais próximo (ele sempre busca pelo "Pendente", então não duplica conclusões).
