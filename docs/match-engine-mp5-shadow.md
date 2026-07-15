# Motor de partida vNext — MP-5 em modo sombra

O MP-5 conecta a carreira existente ao motor vNext sem trocar ainda o resultado oficial. A mesma partida é preparada duas vezes: o motor legado continua produzindo o placar usado pelo save, enquanto o motor candidato recebe escalação, atributos, condição, tática, contexto, árbitro e semente por um adaptador explícito.

## Contrato de segurança

- o placar legado continua sendo o único gravado na carreira;
- uma falha do motor candidato vira diagnóstico e não interrompe a partida;
- nenhum evento, atleta ou estatística do candidato é persistido no save nesta fase;
- entrada igual produz o mesmo ledger e a mesma impressão digital;
- a comparação mede distribuição; não exige que dois simuladores independentes deem o mesmo placar jogo a jogo.

## Adaptação dos atletas

Os 12 atributos atuais não são copiados cegamente para 47 campos. Cada atributo vNext é derivado de fontes relacionadas. Por exemplo:

- cruzamento combina passe, visão, drible e posição;
- cabeceio combina força, posicionamento, nota e função;
- antecipação combina posicionamento, visão e compostura;
- agressividade nasce do temperamento e participa de falta e pressão;
- atributos de goleiro só recebem valores competitivos quando o atleta é goleiro.

Pé dominante, corpo, familiaridade, função e traços são inferidos de forma determinística. Esses dados serão promovidos para entidades permanentes do atleta numa migração posterior; no MP-5 eles existem somente no snapshot da partida.

## Relatório por partida

O plano temporário da partida recebe um `ShadowMatchComparison` com:

- versão do candidato;
- placar legado e placar candidato;
- concordância de resultado;
- diferença de gols, finalizações e posse;
- quantidade de eventos canônicos;
- impressão digital determinística;
- falha contida, quando houver.

O relatório não entra em `GameState`, portanto não aumenta nem altera saves existentes.

## Calibração

```bash
npm run calibrate:match-engine:shadow -- 250
```

O comando mede disponibilidade, repetibilidade, concordância de desfecho e distância estatística entre os motores. A concordância partida a partida é apenas observação: distribuições saudáveis, ausência de falha e replay exato são os portões relevantes para a etapa visual.

### Linha-base de 500 partidas

| Indicador | Resultado |
|---|---:|
| Adaptações concluídas | 500/500 |
| Falhas contidas | 0 |
| Replay exato | 100% |
| Concordância de desfecho | 31,60% |
| Gols por partida — legado | 2,270 |
| Gols por partida — candidato | 2,700 |
| Finalizações por partida — legado | 18,028 |
| Finalizações por partida — candidato | 22,448 |
| Distância absoluta média de posse | 3,8162 p.p. |

A concordância próxima de um terço é coerente para duas sequências aleatórias independentes: o modo sombra compara distribuições, não tenta forçar o candidato a imitar um placar previamente sorteado. A diferença de volume ficará visível no observatório de calibração enquanto o MP-6 passa a consumir a timeline candidata na apresentação da partida.
