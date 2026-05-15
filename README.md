# script-for-conclude

Cansou de ficar 15 minutos olhando pra tela esperando o botão "Marcar como concluído" habilitar? Este script faz isso pra você.

Ele abre a Sala de Aula Virtual da Wyden, entra em cada disciplina, percorre os temas pendentes, espera o cronômetro e clica em concluir. Você pode trabalhar em outra coisa enquanto ele roda.

---

## Início rápido

Se você só quer rodar e ver funcionando:

```bash
git clone https://github.com/AloysioLvy/script-for-conclude.git
cd script-for-conclude
npm install
npx playwright install chromium
npm start
```

Na primeira vez vai abrir uma janela do navegador — faça login normal (Microsoft / aluno), espere chegar na tela inicial com a lista de disciplinas, volte ao terminal e aperte **Enter**. Daí pode deixar rolando.

---

## O que você precisa antes

- **Node.js 18 ou mais novo** ([baixe aqui](https://nodejs.org) se não tiver)
- Sua conta da Sala de Aula da Wyden
- Espaço pra deixar o navegador aberto enquanto roda (o cronômetro da Wyden conta mais devagar se a janela tá minimizada)

Pra conferir se o Node tá instalado:
```bash
node --version
```

---

## Como funciona, passo a passo

Depois que você aperta Enter no terminal, o script:

1. **Lê todas as disciplinas** que aparecem no carrossel da home (se tiverem mais que cabem na tela, ele rola sozinho)
2. **Entra na primeira disciplina** clicando em "Acessar disciplina"
3. **Procura o próximo tema pendente** (ignora os já concluídos)
4. **Abre o conteúdo** — se tem um drawer com vários conteúdos, ele entra no primeiro
5. **Espera o botão habilitar**, checando de minuto em minuto e logando o tempo restante:
   ```
   [13:42:01] tentativa 3/30 — desabilitado — "Marcar como concluído (12:18)"
   ```
6. **Clica em "Marcar como concluído"** assim que pode
7. **Volta** pra lista de temas e procura o próximo pendente
8. Quando acabarem os temas da disciplina, **volta pra home** e passa pra próxima
9. Termina quando não sobrar mais nada pendente

---

## Comandos úteis

> Lembrete: tudo isso roda **dentro da pasta do projeto**. Se abriu um terminal novo, faça `cd script-for-conclude` antes.

| O que você quer fazer                     | Comando                                       |
|-------------------------------------------|-----------------------------------------------|
| Rodar tudo (uso normal)                   | `npm start`                                   |
| Testar com só 1 disciplina e 1 tema       | `MAX_DISCIPLINAS=1 MAX_TEMAS=1 npm start`     |
| Rodar sem janela (depois que confiar)     | `HEADLESS=true npm start`                     |
| Limitar a 3 disciplinas nessa execução    | `MAX_DISCIPLINAS=3 npm start`                 |

### Variáveis disponíveis

| Variável          | Padrão                                  | Pra que serve                                              |
|-------------------|------------------------------------------|------------------------------------------------------------|
| `URL`             | `https://estudante.wyden.com.br/inicio`  | Página inicial — só mude se a Wyden trocar o domínio       |
| `HEADLESS`        | (em branco — janela aberta)              | `true` esconde a janela do navegador                       |
| `MAX_DISCIPLINAS` | `99`                                     | Quantas disciplinas processar                              |
| `MAX_TEMAS`       | `99`                                     | Quantos temas por disciplina                               |
| `MAX_TENTATIVAS`  | `30`                                     | Quantos minutos esperar em cada tema antes de desistir     |

---

## Quando algo dá errado

**"Esperei o tempo todo e o botão não habilitou"**
A Wyden só conta o tempo se a janela estiver ativa. Deixa a janela visível e não minimiza.

**"Pede pra fazer login toda hora"**
Cookies da Microsoft expiram depois de alguns dias. É só relogar quando aparecer.

**"Travou em 'abrindo o tema...'"**
A Wyden pode ter mudado algum botão no site. Abre o DevTools (F12), inspeciona o botão que era pra ser clicado e atualiza o seletor lá no `script.js`.

**"net::ERR_NAME_NOT_RESOLVED"**
Sem internet, ou a URL mudou. Confere a URL no navegador e passa via `URL=...`.

---

## Quero parar no meio

`Ctrl+C` no terminal. Pode parar tranquilo — quando rodar de novo, ele recomeça pelo próximo tema marcado como Pendente, então nada é duplicado.

---

## Estrutura do projeto

```
script-for-conclude/
├── script.js          # Toda a automação
├── package.json       # Dependências
├── README.md          # Você está aqui
├── .gitignore         # Não sobe sessão de login nem node_modules
└── .browser-data/     # Criado no primeiro run, guarda seu login (não commitar)
```

---

## Aviso

Esse repositório é privado e é pra **uso pessoal**. Não compartilhe sua pasta `.browser-data/` — ela contém os cookies de login da sua conta. Não publique fork público — fica óbvio o que o script faz.
