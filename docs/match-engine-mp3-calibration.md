# Motor de partida vNext — relatório MP-3

Data da execução: 14 de julho de 2026  
Versão do motor: `0.3.0-mp3`

## Escopo entregue

- escalação separada do banco de reservas;
- familiaridade por posição e familiaridade tática por função;
- 18 funções com preferências de zona, participação, defesa, jogo aéreo e ação final;
- 21 traços que mudam frequência de escolha sem conceder qualidade automática;
- instruções individuais de risco, drible, cruzamento, finalização, pressão, largura e movimento;
- plano coletivo com formação, mentalidade, ritmo, largura, linhas, pressão, passe, foco, transição e liberdade criativa;
- interpretação das ordens por Trabalho em Equipe, Decisões e familiaridade;
- substituições e alterações de posição, função e tática em tempo de jogo;
- eventos canônicos `substitution` e `tactical_change` no `EventLedger`;
- estado final com titularidade, entrada, saída, posição, função e fadiga de cada relacionado.

## Regra causal das intervenções

Uma intervenção não reescreve a partida. Ela entra como evento confirmado e passa a ser causa do próximo acontecimento:

```text
evento anterior
  └─ decisão do treinador
       ├─ substituição
       └─ mudança tática / posição / função
            └─ somente eventos futuros usam o novo estado
```

Com a mesma entrada e semente, os ledgers de uma partida com e sem ordem futura são idênticos até o relógio da intervenção.

## Calibração geral

Comando:

```bash
npm run calibrate:match-engine -- 10000
```

Configuração: 10.000 sementes distintas, 45 posses por período e os dois times fictícios da prova funcional.

| Métrica | Resultado |
|---|---:|
| Vitória do mandante | 41,99% |
| Empate | 29,57% |
| Vitória do visitante | 28,44% |
| Gols por partida | 2,2175 |
| Finalizações por partida | 20,1778 |
| Cabeçadas por partida | 1,7487 |
| Passes completos | 74,83% |
| Cruzamentos por partida | 10,7596 |
| Cruzamentos completos | 52,71% |
| Dribles por partida | 11,9818 |
| Dribles vencidos | 48,15% |
| Desarmes vencidos | 51,85% |
| Disputas aéreas por partida | 3,8445 |
| Intervenções do goleiro em cruzamentos | 1,8274 |
| Defesas por partida | 6,7722 |
| Fadiga final média por titular | 24,4863 |
| Maior fadiga observada | 38,32 |
| Máximo de gols numa partida | 11 |
| Replay com a mesma semente | exato |

## Sensibilidade tática

Comando:

```bash
npm run calibrate:match-engine:tactics -- 1000
```

Foram executados 1.000 pares com as mesmas sementes.

| Prova | Resultado |
|---|---:|
| Prefixos idênticos antes da ordem futura | 1.000 de 1.000 |
| Violações de causalidade antes da ordem | 0 |
| Cruzamentos após instrução ampla pelos lados | +23,34% |
| Resultados com a instrução | 437 vitórias, 290 empates, 273 derrotas |
| Cruzamentos do atleta com `cruza cedo` | +62,50% |
| Passe familiar contra improvisado | 68,08% contra 63,38% |
| Violações de entrada/saída em substituições | 0 |

A ordem ampla aumentou o comportamento solicitado, mas não virou tática dominante nem garantiu vitória. O traço aumentou a escolha do cruzamento; a fórmula de execução do cruzamento permaneceu inalterada. A familiaridade gerou uma penalidade moderada de percepção, coordenação e execução sem apagar os atributos do atleta.

## Especialistas continuam contextuais

Comando:

```bash
npm run calibrate:match-engine:specialists -- 1000
```

| Especialista | Base | Especialista | Diferença |
|---|---:|---:|---:|
| Lateral cruzador — cruzamentos completos | 53,60% | 64,17% | +10,57 p.p. |
| Ponta driblador — dribles vencidos | 51,74% | 61,12% | +9,38 p.p. |
| Centroavante aéreo — cabeçadas | 241 | 341 | +41,49% |
| Goleiro de elite — gols sofridos | 1.256 | 853 | −32,09% |

Função, traço e instrução não substituem capacidade. Eles alteram onde o jogador aparece e o que tende a tentar; os atributos pertinentes continuam resolvendo a execução contra a oposição.

## Limites conhecidos

- faltas, cartões, impedimentos, acréscimos e bolas paradas ficam para o MP-4;
- janelas formais de substituição por regulamento entram junto às regras de competição;
- rebotes ainda encerram a posse nesta fatia;
- confiança, moral, lesões e disciplina dinâmica serão conectadas em fases posteriores;
- o motor novo continua isolado e não altera saves nem partidas da carreira atual.
