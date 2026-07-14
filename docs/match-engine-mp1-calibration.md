# Motor de partida vNext — relatório MP-0/MP-1

Data da execução: 14 de julho de 2026  
Versão do motor: `0.1.0-mp1`

## Escopo entregue

- contratos validados para jogador, equipe, tática, contexto, estado e evento;
- escala interna de 1 a 100 para 12 atributos essenciais;
- RNG determinístico com semente e rastros auditáveis;
- `EventLedger` imutável, sequencial e com causas anteriores obrigatórias;
- posse orientada a eventos com passe, falha, interceptação, chute, defesa e gol;
- estatísticas reconstruídas exclusivamente do ledger;
- partida vazia reproduzível para a prova de MP-0;
- dois times fictícios de onze jogadores para a fatia vertical de MP-1;
- isolamento explícito do motor legado que ainda atende a carreira atual.

## Calibração de referência

Comando:

```bash
npm run calibrate:match-engine -- 10000
```

Configuração: 10.000 sementes distintas, 30 posses por período e os dois times fixos da prova funcional.

| Métrica | Resultado |
|---|---:|
| Vitória do mandante | 44,89% |
| Empate | 24,64% |
| Vitória do visitante | 30,47% |
| Gols do mandante por partida | 1,7342 |
| Gols do visitante por partida | 1,4222 |
| Gols totais por partida | 3,1564 |
| Finalizações por partida | 25,6916 |
| Passes completos | 76,77% |
| Máximo de gols de uma equipe | 8 |
| Máximo de gols numa partida | 11 |
| Replay com mesma semente | exato |

## Teste de sensibilidade

Em 160 pares de partidas com as mesmas sementes, a elevação de oito pontos nos 12 atributos do mandante produziu:

- vitórias do mandante: de 67 para 120;
- gols do mandante: de 296 para 425;
- aproveitamento de passes: de 77,95% para 80,87%;
- 14 derrotas do time fortalecido, preservando a possibilidade de surpresa.

O teste unitário também confirma que melhorar `finishing` não altera a probabilidade de passe, enquanto melhorar `passing` altera. Isso protege a separação entre atributos pertinentes e irrelevantes.

## Leitura do resultado

A tese de MP-1 está demonstrada: o placar emerge das ações, cada gol possui cadeia causal, a força muda frequências sem garantir vitória e a mesma semente reproduz o jogo.

Os números ainda não representam a calibração comercial definitiva. A média de gols está um pouco alta para algumas competições, e os extremos deverão ser acompanhados quando fadiga, estilos, goleiros completos e diferenças reais de elenco entrarem no modelo.

## Limites conhecidos

- pés, cruzamentos, disputas aéreas, dribles e desarmes detalhados ficam para MP-2;
- formação espacial, funções e instruções completas ficam para MP-3;
- faltas, cartões, impedimentos, acréscimos e bolas paradas ficam para MP-4;
- calibração por liga, nível e estilo fica para MP-5;
- campinho 2D e sequência visual de gol ficam para MP-6;
- o motor novo ainda não altera saves nem resultados da carreira atual.
