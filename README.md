# Eterno FC

Simulador leve e profundo de carreira no futebol, inspirado na agilidade dos antigos managers de texto, mas com um mundo persistente: temporadas, divisões, copas, mercado, treinadores, base e gerações de jogadores.

O projeto é autoral. A versão comercial não dependerá de nomes, escudos ou marcas oficiais; identidades e pacotes de conteúdo ficarão separados do motor do jogo.

## Estado atual

O protótipo roda como uma aplicação web responsiva hospedada nos Sites. Ele já possui partidas narradas em campo, saves locais, calendário, ligas, copas, mercado, base, carreira de treinador e progressão de temporadas.

O trabalho em curso está transformando o protótipo em uma base modular, com regras versionadas por temporada e dados de mundo separados do motor.

## Estrutura

```text
app/
  domain/     tipos e regras fundamentais do domínio
  rules/      calendários e regulamentos por temporada
  game.ts     fachada temporária do motor em processo de divisão
  page.tsx    interface web do jogo
docs/         visão de produto, arquitetura e matrizes de regulamentos
tests/        validações automatizadas
```

## Documentação

- [Visão e decisões do produto](docs/eterno-fc-design-v1.md)
- [Arquitetura técnica proposta](docs/arquitetura-tecnica-proposta-v1.md)
- [Especificação do motor de partida](docs/motor-de-partida-especificacao-v1.md)
- [Matriz brasileira de regulamentos 2026](docs/brasil-matriz-regulamentos-2026.md)
- [Matriz CONMEBOL](docs/conmebol-matriz-regulamentos-2026.md)
- [Matriz UEFA](docs/uefa-matriz-regulamentos-2026-27.md)

As demais matrizes de países estão em `docs/`.

## Desenvolvimento

Requer Node.js 22.13 ou superior.

```bash
npm install
npm run lint
npm test
```

## Fluxo de trabalho

1. Cada mudança relevante nasce em uma branch de trabalho.
2. Motor e regras recebem testes antes de publicação.
3. Um checkpoint validado é publicado nos Sites.
4. O mesmo marco é enviado para este repositório GitHub como histórico e backup.

Saves de jogadores são dados separados do código e não devem ser enviados ao repositório.
