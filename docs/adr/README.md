# Decisões de arquitetura (ADR)

Cada arquivo aqui registra uma decisão que mexe na forma do código: o que estava
em jogo, o que foi escolhido, o que ficou de fora e por quê. O objetivo é que
quem chega entenda o porquê sem precisar caçar no `git log`.

## Como escrever

- Um arquivo por decisão: `NNNN-titulo-curto.md`, numerado em sequência.
- Seções: **Contexto** (o problema antes da solução), **Decisão**,
  **Alternativa considerada** e **Consequências**.
- Status: `proposta` enquanto o dono do repositório não aprovou; `aceita`
  depois. Decisão revista não é apagada: o ADR antigo vira
  `substituída por NNNN` e o novo explica o que mudou.
- Resuma a regra no `CLAUDE.md` e no `CONTRIBUTING.md` e aponte para o ADR.

## Registro

| # | Decisão | Status |
|---|---|---|
| [0001](0001-pastas-por-camada.md) | Pastas organizadas por camada | aceita |
