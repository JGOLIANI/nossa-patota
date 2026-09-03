# Nossa Patota

Aplicativo web (PWA) para gerenciar uma patota de futsal: jogadores, partidas,
times equilibrados, gols ao vivo, estatísticas, rankings e premiações — tudo
com ferramentas gratuitas e instalável na tela inicial do celular.

<p align="center">
  <img src="public/icons/icon-192.png" width="96" alt="Ícone do Nossa Patota" />
</p>

---
### Defina a agenda

Em **Perfil → Administração → Agenda da patota**, informe o dia da semana, o
horário, o local e quantas vagas a partida tem. O sistema passa a criar as
próximas partidas sozinho, e os jogadores confirmam presença por conta própria.

Combinado que muda depois — a quadra sem luz, o horário que atrasa — se
resolve na própria partida: enquanto os times não foram sorteados, o lápis no
alto da tela abre data, horário, local e vagas para edição, sem perder as
confirmações que já chegaram.

No local há dois campos: o nome, que é como a patota chama o lugar, e o link do
Google Maps, que é o endereço de verdade. Para pegar o link, toque em
**Procurar no Google Maps**, ache o lugar, use o botão de compartilhar do Maps
e cole aqui. Ele vai junto na mensagem de escalação, e quem nunca foi abre a
navegação direto do grupo. Sem o link o mapa ainda abre, por uma busca pelo
nome — o que acerta a quadra conhecida e erra a quadra sem placa.

### Instale no celular

Na primeira abertura o app desce um balão no topo da tela convidando a
instalá-lo, e o balão inteiro é tocável. No Chrome e no Edge o toque abre o
diálogo de instalação do próprio navegador — um toque e o ícone está na tela
de início. Safari, Firefox e todos os navegadores do iPhone não dão a nenhuma
página o poder de se instalar sozinha; neles o toque abre o passo a passo, e o
caminho é este:

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

A régua dos dois cartões é a miniatura do grupo: com uns 200 pixels de largura,
a imagem precisa dizer a que veio antes de alguém tocar nela.

A **escalação** traz uma coluna por time e um nome por linha, com a ficha do
jogador e a marcação de quem foi para o gol. A versão anterior espalhava os
jogadores por uma quadra de futsal desenhada — bonita e ilegível: catorze
fichas pequenas viram catorze borrões quando a imagem chega reduzida. Fotos que
o servidor não libera por CORS caem nas iniciais, porque uma imagem sem
permissão impediria a geração do PNG.

O **resumo da partida** põe o placar em 116 pixels de altura, porque é a única
coisa que precisa ser legível na miniatura, e deixa destaques e artilharia
abaixo, para quem abrir.

A mensagem da **escalação** traz os dois times por extenso, um nome por linha,
com a marcação de quem ficou no gol. No grupo a imagem chega como miniatura e
nem todo mundo abre; o nome em texto também é o que se procura com a busca do
WhatsApp e o que o leitor de tela alcança — a imagem, para os dois, não existe.

A mensagem do **resultado** traz o placar, a artilharia e o pódio.

O resultado só pode ser compartilhado depois que a urna fecha. Mandar antes
seria anunciar como definitivo um pódio que os votos que faltam ainda podem
mudar — e ninguém desmente um print. Enquanto a votação corre, a tela diz
quando o botão aparece.

No celular abre direto o menu de compartilhar; no computador, baixa o arquivo.

### Premiações da partida

Os **três** prêmios são votados. Encerrar a partida não decide nada: abre uma
urna de **16 horas** para quem foi escalado — quem estava em quadra é quem viu
o jogo, e ninguém vota em si mesmo. Dezesseis horas cobrem a noite e a manhã
seguinte, então quem jogou na sexta à noite ainda vota no sábado. Enquanto a
urna está aberta, o cartão de Destaques da tela de início é o botão que leva
direto à cédula.

| Prêmio | Quem disputa | Estatística que pesa |
| --- | --- | --- |
| Craque da Partida | **Quem jogou a partida** | Mais participações em gols |
| Bagre da Rodada | **Quem jogou a partida** | Menos participações em gols |
| Paredão | Quem jogou no gol | Menos gols sofridos |

Craque e Bagre concorrem entre todos que entraram em quadra, dos dois times e
das duas posições. Antes cada um ficava preso a um lado do placar — o Craque só
entre os vencedores, o Bagre só entre os derrotados —, e isso já decidia metade
do prêmio antes de a patota abrir a boca: quem carregou o time e perdeu não
podia ser craque, e quem passou a partida escondido no time que ganhou não podia
ser bagre. Quem viu o jogo sabe distinguir as duas coisas.

O **Paredão** disputa entre quem esteve no gol, mas quem vota é a patota
inteira — não só os goleiros. Gol sofrido conta a metade fácil da história: a
defesa que salvou a partida e o frango que ninguém esquece não aparecem no
número, e quem estava lá viu os dois.

A nota de cada candidato é **70% da fatia de votos** que recebeu e **30% da
estatística** do prêmio, normalizada entre os candidatos. Quem estava lá viu
coisas que o placar não registra — a defesa na linha, o passe que ninguém
converteu —, mas voto sozinho vira popularidade.

Gol e assistência não medem quem passou a partida no gol, então para o goleiro
a parte estatística fica **neutra** nos dois prêmios de linha: sem isso, o zero
natural de quem defende o colocaria em último no Craque e em primeiro no Bagre
toda semana, por fazer exatamente o que se espera dele. Sobra o voto — que é
quem sabe se o goleiro salvou ou entregou a partida.

Se ninguém votar, a nota vira só a estatística da partida, que é exatamente o
critério anterior: a rodada em que ninguém votou continua tendo um resultado justo em
vez de nenhum. Nesse caso vale também a guarda antiga — quando ninguém na
partida participou de gol, o prêmio não sai, porque premiar um 0 a 0 seria
sortear um nome, e prêmio sorteado não diz nada de quem o levou. Havendo voto,
a patota decidiu, e o prêmio sai.

**Sai um só por categoria.** Quando dois candidatos terminam com a mesma nota,
a cascata de desempate decide, nesta ordem:

1. **mais votos** na contagem bruta;
2. o **desempate fino da estatística** — gols, depois assistências, na direção
   do prêmio. É o que a métrica principal esconde: participações não distinguem
   três gols de um gol com duas assistências, e o pódio distingue;
3. **quem menos levou aquele prêmio** na história, o que espalha os troféus em
   vez de concentrar no mesmo de sempre. A própria rodada fica de fora da
   conta: reapurar uma rodada já gravada leria os prêmios dela como histórico,
   e o vencedor seria punido pela própria vitória;
4. um **sorteio semeado** pela rodada e pelo prêmio. Não é justo, mas é
   decidido e reprodutível — a tela e o banco nunca discordam de quem levou.

Rodadas gravadas antes desta regra podem ter dois nomes na mesma categoria, e
as telas continuam mostrando os dois: apagar o histórico para caber no formato
novo seria pior.

Fecham a urna duas coisas. O prazo corre sozinho, e o administrador pode
**encerrar antes**, pela aba Prêmios — quando todo mundo já votou, o resultado
fica preso por horas sem motivo, e é logo depois do jogo que a patota quer ver
o pódio. A confirmação diz quantos já votaram; encerrar é definitivo e o
servidor passa a recusar voto novo.

Apurar é encerrar: a marca da apuração fecha a votação nos dois casos. Gravar o
resultado é escrita, e escrita precisa de permissão — então, quando o prazo
vence sozinho, a apuração acontece na primeira vez que um administrador abre o
aplicativo. Até lá as telas mostram a mesma apuração calculada na hora, então
ninguém vê número diferente do que vai ser gravado.

> Quem pode votar, em quem, e até quando são regras do servidor, na função
> `cast_vote`: no navegador seriam só uma sugestão.
