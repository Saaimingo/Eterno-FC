# Motor de partida vNext — calibração do MP-4

## Objetivo

O MP-4 acrescenta as regras essenciais sem abandonar a premissa central do motor: nenhum resultado nasce pronto. Falta, cartão, impedimento, bola parada, rebote e acréscimo são decisões canônicas derivadas dos jogadores, da tática, do árbitro, da oposição e da semente.

```text
ação anterior
  ├─ contato defensivo
  │    └─ falta
  │         ├─ sanção disciplinar
  │         └─ falta / pênalti
  │              └─ finalização / defesa / gol
  ├─ passe tentado
  │    └─ impedimento
  └─ finalização defendida
       └─ rebote
            ├─ corte defensivo
            └─ segunda finalização
```

## Contratos introduzidos

- `MatchRules`: limite de substituições, expulsão pelo segundo amarelo, impedimento e acréscimos;
- `RefereeProfile`: rigor, tendência de cartões, tendência de pênaltis e gestão de acréscimos;
- estados de atleta com amarelos e `sent_off`;
- eventos `foul`, `yellow_card`, `red_card`, `offside`, `free_kick`, `corner`, `penalty_kick`, `rebound` e `stoppage_time`;
- estatísticas reconstruídas de faltas, cartões, impedimentos, bolas paradas e rebotes.

Uma expulsão remove o jogador do runtime. Ele não pode participar de eventos posteriores. Se uma substituição previamente programada se tornar impossível porque o atleta foi expulso, ela é registrada como cancelada e não corrompe a partida.

## Como cada regra é resolvida

### Falta e disciplina

O risco de falta combina agressividade, desarme, decisões, compostura, concentração, fadiga, pressão coletiva, instrução individual, traços e rigor do árbitro. O cartão é uma segunda resolução: a falta pode existir sem cartão, e um atleta tecnicamente forte no desarme tende a cometer menos infrações mesmo sob pressão.

Segundo amarelo e vermelho direto geram um evento de expulsão separado. A equipe continua com menos jogadores e todos os cálculos seguintes usam a nova formação numérica.

### Impedimento

O impedimento só é testado em passes executados de progressão ou criação. Risco, ritmo, passe direto, movimento de ataque, função e linha defensiva aumentam a exposição; desmarque, antecipação, decisões, trabalho em equipe e familiaridade ajudam o atacante a sincronizar a corrida.

### Bolas paradas

- falta em zona recuada: reinício curto;
- falta em criação ou perigo: cobrança direta ou entrega aérea;
- falta de alto risco na área: possibilidade contextual de pênalti;
- cruzamento bloqueado ou chute desviado: escanteio;
- `freeKick`, `corners` e `penalties` governam suas especialidades sem receber bônus genérico de “craque”.

### Rebotes

Uma defesa encaixada encerra a jogada. Uma defesa espalmada abre disputa pela segunda bola, resolvida por antecipação, movimentação, aceleração, posicionamento, concentração e participação do goleiro. O motor permite uma segunda finalização e então fecha o encadeamento, evitando ciclos artificiais.

### Acréscimos

Gols, faltas, cartões, substituições, período e perfil do árbitro compõem os segundos anunciados. O MP-4 converte esse tempo em até quatro posses extras marcadas como `stoppage_time`. O `clockMs` canônico permanece limitado aos 45/90 minutos para preservar intervenções e compatibilidade; a apresentação deverá ler `addedSeconds` do evento para exibir `45+N` e `90+N`.

## Calibração geral

Comando:

```bash
npm run calibrate:match-engine -- 10000
```

| Indicador | Resultado |
|---|---:|
| Vitória do mandante | 42,34% |
| Empate | 28,50% |
| Vitória do visitante | 29,16% |
| Gols por partida | 2,2830 |
| Finalizações por partida | 21,2482 |
| Passes completos | 74,27% |
| Cruzamentos por partida | 8,8888 |
| Dribles por partida | 9,7641 |
| Replay com a mesma semente | exato |

O máximo observado foi de 11 gols, sem ruptura do placar, do ledger ou da ordem temporal.

## Calibração das regras

Comando:

```bash
npm run calibrate:match-engine:rules -- 1000
```

| Indicador | Média por partida |
|---|---:|
| Posses canônicas | 94,3030 |
| Faltas | 14,4380 |
| Amarelos | 2,6930 |
| Vermelhos | 0,2090 |
| Impedimentos | 1,8910 |
| Escanteios | 4,3370 |
| Pênaltis | 0,2010 |
| Rebotes | 3,3880 |
| Acréscimos somados | 7,7962 min |

- conversão de pênaltis: 69,15%;
- recuperação ofensiva de rebotes: 37,37%;
- zero ações posteriores de atletas expulsos;
- zero quebras nas causas de impedimento, pênalti ou rebote.

O modelo trabalha com posses abstratas, não com cada toque real. Essas médias são a linha-base interna do simulador e serão revistas quando o adaptador do campo 2D trouxer mais granularidade espacial.

## Sensibilidade sem roteiro

Em 1.000 pares com as mesmas sementes:

- árbitro permissivo: 8.370 faltas e 1.358 cartões;
- árbitro rigoroso: 20.807 faltas e 5.848 cartões;
- ataque cauteloso contra bloco baixo: 327 impedimentos;
- ataque direto/agressivo contra linha alta: 1.778 impedimentos.

O árbitro muda a fronteira de decisão, mas não escolhe vencedor. A linha alta aumenta a chance de impedimento, mas continua sujeita à inteligência de passe e corrida.

## Capacidades anteriores preservadas

Em 1.000 pares por cenário:

- lateral cruzador: +12,68 p.p. de cruzamentos completos;
- ponta driblador: +7,86 p.p. de dribles vencidos;
- centroavante aéreo: +30,77% de cabeçadas;
- goleiro de elite: −28,48% de gols sofridos;
- mudança para amplitude: +19,81% de cruzamentos, com 411 vitórias, 283 empates e 306 derrotas;
- 1.000/1.000 prefixos idênticos antes de uma ordem tática futura.

## Limites conhecidos

- vantagem após falta, mão na bola e VAR ficam para uma etapa posterior;
- lesões e atendimento médico ainda não consomem tempo nem forçam substituição;
- prorrogação e disputa por pênaltis serão regras específicas de mata-mata;
- janelas formais de substituição por regulamento ainda não são aplicadas;
- o motor novo permanece isolado das partidas visíveis da carreira até o adaptador explícito.
