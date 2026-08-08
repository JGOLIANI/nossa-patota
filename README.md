# Nossa Patota

Aplicativo web (PWA) para gerenciar uma patota de futsal: jogadores, partidas,
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
patota fictícia com 14 jogadores, 3 partidas já jogadas e uma partida aberta para
confirmar presença, guardada apenas no navegador. Entre com o usuário `admin`
(administrador) ou `igor` (jogador comum) e qualquer senha.

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
tabelas, os índices, as políticas de segurança (RLS), a função de confirmação
de presença e o bucket de fotos — onde cada jogador só escreve na própria
pasta. Pode ser reaplicado quantas vezes quiser: não
apaga nada do que já existe.

### 4. Desligue a confirmação de e-mail

Em **Authentication → Providers → Email**, desmarque *Confirm email*. O login
da patota é por nome de usuário: o aplicativo converte `fulano` em
`fulano@patota.local`, um domínio reservado que nunca entrega mensagens.

### 5. Primeiro acesso

Abra o aplicativo, toque em **Primeiro acesso** e preencha seu cadastro.
**A primeira conta criada vira a administradora da patota** — faça a sua antes
de divulgar o endereço, porque enquanto ninguém tiver entrado a porta está
aberta e quem chegar primeiro vira dono.

Daí em diante cada jogador se cadastra sozinho pelo mesmo caminho, informando
nome completo, nome de usuário (sugerido a partir do nome: `Igor Santos` vira
`igor.santos`), senha, tipo, posição e perna dominante. Todas as contas entram
como jogador comum; promover alguém a administrador é sempre um ato explícito
de outro administrador, em **Perfil → Administração**.

O nível não é perguntado no cadastro — ninguém se autoavalia. Todo mundo começa
em 3 e o administrador ajusta depois, ao editar o jogador.

> O administrador ainda pode abrir a ficha de alguém antes, em **Jogadores →
> Novo jogador** — útil para o visitante que não usa o aplicativo. Quando essa
> pessoa se cadastrar com o mesmo nome de usuário, ela assume a ficha e o
> histórico dela.

### 5.1. Feche a porta: o código da patota

Em **Perfil → Administração → Código da patota**, defina uma palavra que o
jogador precisa digitar para se cadastrar. Sem código, qualquer pessoa com o
endereço do aplicativo entra na patota — o que costuma bastar enquanto o link
circula só no grupo, mas não depois que ele vaza.

Trocar o código não afeta quem já entrou: vale para os cadastros seguintes.

### 5.2. Quem esqueceu a senha

O login é por nome de usuário, e o endereço `@patota.local` não recebe
mensagem nenhuma — então não há link de recuperação para enviar. Quem destrava
é o administrador: em **Elenco**, toca no nome da pessoa e usa **Redefinir
senha**. A senha passa a ser `patota123` — fixa e conhecida de propósito, para
ele conseguir ditá-la no grupo sem copiar e colar.

O que a torna segura o bastante é durar uma entrada só: quem entra com ela cai
direto numa tela que exige uma senha nova e não deixa usar mais nada do
aplicativo antes disso.

A troca roda em uma função dentro do banco, protegida por `is_admin()`, porque
alterar a senha de outra conta é privilégio da chave `service_role` — que nunca
pode ir para o navegador.

### 5.3. Defina a agenda

Em **Perfil → Administração → Agenda da patota**, informe o dia da semana, o
horário, o local e quantas vagas a partida tem. O sistema passa a criar as
próximas partidas sozinho, e os jogadores confirmam presença por conta própria.

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

### Cadastro e acesso

Quem se cadastra não tem sessão, e a escrita em `players` é reservada aos
administradores pelo RLS — então não é o navegador que cria o jogador. O
formulário viaja como metadados da conta e quem grava a linha é o gatilho
`handle_new_user`, dentro da mesma transação que cria a conta: se ele recusa,
não sobra usuário órfão nem ficha pela metade.

É lá que ficam as três garantias que não podem depender do cliente se
comportar bem: o código da patota é conferido no servidor, ninguém nasce
administrador (exceto a primeira conta, que é livre porque ainda não existe
alguém para autorizá-la) e uma ficha que já tem dono não é tomada por outra
conta. Valores fora das listas de tipo, posição e perna viram o padrão em vez
de derrubar o cadastro.

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

### Partidas e presença

A patota tem dia fixo, então o administrador descreve o compromisso uma vez e o
sistema mantém as próximas semanas sempre criadas. Cada jogador confirma a
própria presença; quando as vagas acabam, quem confirma entra na **lista de
espera** e sobe automaticamente se alguém desiste — a ordem é a da confirmação.
Cada partida tem um placar: o sorteio divide quem confirmou em dois times
equilibrados e já abre o jogo, sem um segundo passo para criar a partida.

A confirmação roda em uma função dentro do banco, e não no aplicativo, por dois
motivos: promover alguém da espera altera a linha de outro jogador, o que as
políticas de segurança impediriam; e uma trava por partida evita que duas
pessoas confirmando ao mesmo tempo ocupem a mesma última vaga.

Mudar o dia da patota recolhe o que a agenda antiga tinha deixado: as partidas
futuras do dia velho que ninguém tocou — ainda em rascunho, sem uma única
resposta de presença — saem junto com a troca. Basta alguém ter confirmado ou o
administrador ter sorteado os times para a partida ficar de pé; apagá-la passa
a ser decisão dele.

> As partidas futuras são materializadas quando um administrador abre o
> aplicativo — planos gratuitos não executam tarefas agendadas no servidor.

### Compartilhar no WhatsApp

Duas imagens são geradas no próprio aparelho, em canvas, sem biblioteca
nenhuma.

A **escalação** mostra uma quadra de futsal com os cinco titulares de cada time
nas posições reais — goleiro, fixo, alas e pivô —, cada um com a foto do perfil
e o nome. Quem passa de cinco vai para o banco de reservas, na lateral da
quadra. Fotos que o servidor não libera por CORS caem nas iniciais, porque uma
imagem sem permissão impediria a geração do PNG.

O **resumo da partida** traz placar, premiações e artilharia.

No celular abre direto o menu de compartilhar; no computador, baixa o arquivo.

### Premiações da partida

| Prêmio | Critério |
| --- | --- |
| Craque da Partida | Mais participações em gols (gols + assistências) no **time vencedor** |
| Bola Murcha | Menos participações em gols no **time derrotado** |
| Paredão | Quem sofreu menos gols entre os que jogaram no gol |

Os dois prêmios de linha são simétricos, cada um preso ao seu lado do placar.

No empate não há vencedor nem derrotado, então os dois prêmios passam a olhar
a partida inteira: o melhor é quem mais participou de gols entre todos, o pior é
quem menos participou. Empates dentro do prêmio devolvem todos os empatados.

Quando ninguém do lado avaliado participou de gol, o prêmio simplesmente não
sai — vale para os dois, como manda a simetria. Um 1 a 0 de gol contra não tem
Craque da Partida, e uma derrota sem nenhum gol do time não tem Bola Murcha:
se todo mundo ali está em zero, ninguém se destacou, e um prêmio que cabe no
time inteiro não diz nada sobre nenhum dos premiados.

### Goleiro que joga na linha

A posição é registrada **por partida**, não só no cadastro. Na aba Times o
administrador toca na luva para trocar quem está no gol, e isso muda tudo que
depende da posição: gols sofridos e jogos sem sofrer gol contam apenas para
quem esteve debaixo das traves, e quem subiu para a linha passa a disputar os
prêmios de linha.

Gol é gol: o goleiro que marca entra na artilharia como qualquer outro. O único
ranking restrito é o de Paredão, que considera só as partidas
disputadas no gol.

---

## Desempenho

Nada é pré-calculado no banco: estatísticas, rankings e prêmios saem sempre do
histórico completo. Isso mantém os números coerentes, mas coloca o custo dessas
funções no caminho da interface — então ele é medido.

```bash
npm run bench
```

Medido com a CPU quatro vezes mais lenta que a da máquina de desenvolvimento,
o que aproxima um celular mediano:

| Patota | `computeStats` | `buildRankings` | Lista de partidas | Abrir partida |
| --- | --- | --- | --- | --- |
| 30 jogadores, 2 anos | 0,5 ms | 1,0 ms | 252 ms | 187 ms |
| 60 jogadores, 5 anos | 1,6 ms | 3,4 ms | 263 ms | 244 ms |
| 120 jogadores, 10 anos | 4,8 ms | 8,4 ms | 360 ms | 194 ms |

As contas nunca foram o gargalo — o tempo estava em varrer o histórico inteiro
uma vez por linha da lista. Duas medidas resolveram:

- **Índices por snapshot** em [`src/domain/selectors.ts`](src/domain/selectors.ts):
  um `WeakMap` guarda mapas de partida, time e placar montados uma única vez.
  Como cada recarga cria um objeto novo, o cache se invalida sozinho.
- **Lista de partidas paginada**, 24 por vez. Renderizar 520 linhas custava mais
  de um segundo sem que ninguém rolasse até o fim.

Na maior escala a lista caiu de 2884 ms para 360 ms e a pior travada do
aplicativo, de 1238 ms para 181 ms.

O aplicativo baixa cerca de 175 KB comprimidos na primeira visita e nada nas
seguintes, já que o service worker serve tudo do cache.

### O limite conhecido

O aplicativo carrega o histórico inteiro a cada abertura: 61 KB comprimidos
para cinco anos de patota, 132 KB para dez. É aceitável hoje e simplifica todo
o resto, mas cresce para sempre. Quando incomodar, o caminho é buscar as
partidas por página e guardar um resumo por jogador, em vez de recalcular tudo.

## Estrutura

```
src/
  domain/      regras puras e testadas: estatísticas, prêmios, balanceamento,
               rankings, agenda e confirmação de presença
  data/        persistência: backend Supabase e backend local (demonstração)
  store/       estado da aplicação e ações
  components/  peças de interface reutilizáveis
  pages/       telas
supabase/
  schema.sql   banco completo com RLS, triggers e bucket de fotos
  tests/       testes SQL das políticas de segurança
  lib/
    shareCard.ts      imagens de escalação e resumo, desenhadas em canvas
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
| `npm run bench` | Benchmarks das regras de negócio em quatro escalas |

### Testando as políticas de segurança

Com um PostgreSQL local:

```bash
psql -d patota -f supabase/tests/local_prelude.sql   # simula auth/storage do Supabase
psql -d patota -f supabase/schema.sql
psql -d patota -f supabase/tests/rls_test.sql        # 21 verificações
```

---

## Ideias para as próximas versões

- **Confirmação de presença** na partida pelos próprios jogadores, com lista de
  espera — hoje o administrador monta a lista sozinho.
- **Atualização ao vivo** via Supabase Realtime, para todo mundo acompanhar o
  placar pelo celular enquanto joga.
- **Financeiro da patota**: mensalidades, diária de visitante e quem está
  devendo.
- **Sorteio com restrições**: marcar duplas que não podem cair no mesmo time.
- **Cartões e faltas**, além dos gols, no controle da partida.
- **Compartilhar a partida** como imagem pronta para o grupo do WhatsApp.
