# Nossa Patota

Aplicativo web (PWA) para gerenciar uma patota de futsal: jogadores, rodadas,
times equilibrados, gols ao vivo, estatísticas, rankings e premiações — tudo
com ferramentas gratuitas e instalável na tela inicial do celular.

<p align="center">
  <img src="public/icons/icon-192.png" width="96" alt="Ícone do Nossa Patota" />
</p>

---

## Experimente agora, sem configurar nada

```bash
npm install
npm run dev
```

Sem credenciais do Supabase o aplicativo abre em **modo demonstração**: uma
patota fictícia com 14 jogadores e 3 rodadas já jogadas, guardada apenas no
navegador. Entre com o usuário `admin` (administrador) ou `igor` (jogador
comum) e qualquer senha.

---

## Colocando no ar de verdade

Tudo aqui cabe nos planos gratuitos: **Supabase** (banco, autenticação e
armazenamento de fotos), **GitHub Actions** (deploy automático) e **GitHub
Pages** (hospedagem com HTTPS, que o PWA exige).

### 1. Crie o projeto no Supabase

Em [supabase.com](https://supabase.com) crie um projeto gratuito e anote,
em **Project Settings → API**, a *Project URL* e a chave *anon public*.

### 2. Configure o aplicativo

```bash
npm run setup
```

O script pergunta a URL e a chave, grava o arquivo `.env`, valida o formato
(inclusive recusando a chave `service_role`, que nunca deve ir para o
navegador) e testa a conexão. Outras formas de usar:

```bash
npm run setup -- --check                       # só valida o que já existe
npm run setup -- --demo                        # volta ao modo demonstração
npm run setup -- --url=<URL> --key=<KEY> --yes # sem perguntas, para automação
```

### 3. Aplique o schema

No painel do Supabase abra **SQL Editor → New query**, cole todo o conteúdo de
[`supabase/schema.sql`](supabase/schema.sql) e execute. O arquivo cria as
tabelas, os índices, as políticas de segurança (RLS), o bucket de fotos e o
primeiro jogador administrador. Pode ser reaplicado quantas vezes quiser.

### 4. Desligue a confirmação de e-mail

Em **Authentication → Providers → Email**, desmarque *Confirm email*. O login
da patota é por nome de usuário: o aplicativo converte `fulano` em
`fulano@patota.local`, um domínio reservado que nunca entrega mensagens.

### 5. Primeiro acesso

Abra o aplicativo, toque em **Primeiro acesso** e crie a senha do usuário
`admin`. A partir daí, cadastre os jogadores; cada um cria a própria senha
usando o mesmo fluxo, com o nome de usuário que você definiu. Quem não estiver
cadastrado não consegue criar conta.

### 6. Deploy automático

Em **Settings → Pages**, escolha *Source: GitHub Actions*. Em
**Settings → Secrets and variables → Actions**, cadastre `VITE_SUPABASE_URL` e
`VITE_SUPABASE_ANON_KEY`. Todo push na branch `main` roda lint, testes, build e
publica o site.

> Prefere Vercel ou Netlify? Importe o repositório, informe as duas variáveis de
> ambiente e pronto — nesse caso não defina `VITE_BASE`, que só é necessário no
> GitHub Pages por causa do subdiretório.

### 7. Instale no celular

- **Android (Chrome):** menu ⋮ → *Adicionar à tela inicial*.
- **iPhone (Safari):** botão Compartilhar → *Adicionar à Tela de Início*.

O aplicativo abre em tela cheia, funciona offline para as telas já visitadas e
não precisa de loja de aplicativos.

---

## Como o sistema decide as coisas

### Times equilibrados

Cada participante recebe uma nota de 0 a 100 calculada a partir de oito
fatores, cada um com peso configurável em
[`src/domain/balance.ts`](src/domain/balance.ts):

| Fator | Peso padrão |
| --- | --- |
| Nível informado pelo administrador | 25% |
| Aproveitamento | 15% |
| Desempenho recente (últimas 5 partidas) | 15% |
| Média de gols | 15% |
| Média de assistências | 10% |
| Participações em gols por partida | 10% |
| Vitórias | 5% |
| Derrotas (invertido) | 5% |

Com as notas em mãos, o algoritmo espalha os goleiros (um por time enquanto
houver), distribui os jogadores de linha sempre para o time mais fraco no
momento e, por fim, testa trocas de pares até que a diferença entre as médias
dos times pare de cair. Quem ainda não jogou recebe valor neutro nos fatores
históricos, para não ficar sempre no fim da fila.

### Estatísticas

Só entram partidas **encerradas** — enquanto a partida está ao vivo, o placar
ainda pode ser corrigido. O placar nunca é digitado: ele é derivado dos gols
registrados, inclusive os gols contra, que contam para o time beneficiado mas
não para a artilharia do autor. Aproveitamento usa o critério 3-1-0
(vitória, empate, derrota).

### Premiações da rodada

| Prêmio | Critério |
| --- | --- |
| Jogador da Rodada | Jogador de linha com mais participações em gols (gols + assistências) |
| Pior Jogador da Rodada | Jogadores de linha que terminaram sem nenhuma participação em gol |
| Goleiro Menos Vazado | Goleiro que sofreu menos gols na rodada |

Empates devolvem todos os empatados. Se ninguém participou de gol algum, não há
Jogador da Rodada.

---

## Estrutura

```
src/
  domain/      regras puras e testadas: estatísticas, prêmios, balanceamento, rankings
  data/        persistência: backend Supabase e backend local (demonstração)
  store/       estado da aplicação e ações
  components/  peças de interface reutilizáveis
  pages/       telas
supabase/
  schema.sql   banco completo com RLS, triggers e bucket de fotos
  tests/       testes SQL das políticas de segurança
scripts/
  setup.mjs           configuração guiada do .env
  generate-icons.mjs  ícones do PWA gerados sem dependências
```

As regras de negócio ficam isoladas em `src/domain`, sem React e sem banco: é
lá que estão os testes e é lá que se muda o comportamento do sistema.

## Comandos

| Comando | O que faz |
| --- | --- |
| `npm run dev` | Servidor de desenvolvimento |
| `npm run build` | Verificação de tipos + build de produção |
| `npm test` | Testes das regras de negócio |
| `npm run lint` | ESLint |
| `npm run setup` | Configuração do Supabase |
| `npm run icons` | Regenera os ícones do PWA |

### Testando as políticas de segurança

Com um PostgreSQL local:

```bash
psql -d patota -f supabase/tests/local_prelude.sql   # simula auth/storage do Supabase
psql -d patota -f supabase/schema.sql
psql -d patota -f supabase/tests/rls_test.sql        # 9 verificações de permissão
```

---

## Ideias para as próximas versões

- **Confirmação de presença** na rodada pelos próprios jogadores, com lista de
  espera — hoje o administrador monta a lista sozinho.
- **Atualização ao vivo** via Supabase Realtime, para todo mundo acompanhar o
  placar pelo celular enquanto joga.
- **Financeiro da patota**: mensalidades, diária de visitante e quem está
  devendo.
- **Sorteio com restrições**: marcar duplas que não podem cair no mesmo time.
- **Cartões e faltas**, além dos gols, no controle da partida.
- **Compartilhar a rodada** como imagem pronta para o grupo do WhatsApp.
