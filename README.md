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


### 5.3. Defina a agenda

Em **Perfil → Administração → Agenda da patota**, informe o dia da semana, o
horário, o local e quantas vagas a partida tem. O sistema passa a criar as
próximas partidas sozinho, e os jogadores confirmam presença por conta própria.

### 7. Instale no celular

- **Android (Chrome):** menu ⋮ → *Adicionar à tela inicial*.
- **iPhone (Safari):** botão Compartilhar → *Adicionar à Tela de Início*.

O aplicativo abre em tela cheia, funciona offline para as telas já visitadas e
não precisa de loja de aplicativos.

---
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
