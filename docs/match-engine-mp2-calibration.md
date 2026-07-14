# Motor de partida vNext — relatório MP-2

Data da execução: 14 de julho de 2026  
Versão do motor: `0.2.0-mp2`

## Escopo entregue

- 47 atributos contextuais divididos em técnicos, mentais, físicos e de goleiro;
- proficiência independente dos dois pés, inclusive uso forçado do pé fraco;
- altura e massa separadas da técnica de cabeceio;
- fadiga dinâmica por participação, condição, resistência e condição natural;
- pressão variável por fase, importância, placar e momento da partida;
- escolha entre chute, drible e cruzamento depois da criação;
- drible contestado por desarme;
- cruzamento contestado pelo marcador, pelo goleiro e por disputa aérea;
- goleiros com reflexos, um contra um, segurança, alcance e comando de área;
- defesas com resultado de encaixe ou rebote;
- auditoria dos eventos com pé, fadiga, pressão e componentes da probabilidade;
- estatísticas reconstruídas exclusivamente a partir do `EventLedger`.

## Calibração geral

Comando:

```bash
npm run calibrate:match-engine -- 10000
```

Configuração: 10.000 sementes distintas, 45 posses por período e os dois times fictícios da prova funcional.

| Métrica | Resultado |
|---|---:|
| Vitória do mandante | 41,88% |
| Empate | 29,70% |
| Vitória do visitante | 28,42% |
| Gols por partida | 2,1435 |
| Finalizações por partida | 20,6741 |
| Cabeçadas por partida | 1,8749 |
| Passes completos | 75,65% |
| Cruzamentos por partida | 11,9748 |
| Cruzamentos completos | 51,88% |
| Dribles por partida | 11,2147 |
| Dribles vencidos | 48,01% |
| Desarmes vencidos | 51,99% |
| Disputas aéreas por partida | 4,1210 |
| Intervenções do goleiro em cruzamentos | 2,0921 |
| Defesas por partida | 7,0434 |
| Fadiga final média por jogador | 26,9175 |
| Maior fadiga observada | 42,40 |
| Máximo de gols numa partida | 9 |
| Replay com a mesma semente | exato |

## Prova de especialistas

Comando:

```bash
npm run calibrate:match-engine:specialists -- 1000
```

Foram executados 1.000 pares por perfil, sempre com as mesmas sementes e sem qualquer marcador oculto de estrela.

| Especialista | Base | Especialista | Diferença |
|---|---:|---:|---:|
| Lateral cruzador — cruzamentos completos | 56,49% | 66,25% | +9,77 p.p. |
| Ponta driblador — dribles vencidos | 52,20% | 61,54% | +9,34 p.p. |
| Centroavante aéreo — cabeçadas | 280 | 361 | +28,93% |
| Goleiro de elite — gols sofridos | 1.232 | 805 | −34,66% |

O valor do especialista aparece somente quando a partida oferece sua situação. A melhora do cruzamento não altera a resolução de drible; `Cabeceio` melhora a direção da cabeçada, mas não a capacidade física de ganhar a altura; atributos de goleiro não melhoram ações de linha sem relação.

## Causalidade adicionada

```text
passe confirmado
  ├─ chute → defesa ou gol
  ├─ drible → desarme vencido ou linha quebrada → chute
  └─ cruzamento
       ├─ bloqueio
       ├─ intervenção do goleiro
       └─ disputa aérea → corte ou cabeçada → defesa ou gol
```

Cada seta é um evento confirmado com causa anterior. O placar continua sendo apenas uma projeção dos eventos de gol.

## Leitura dos números

O MP-2 demonstra a tese de especialistas contextuais e confrontos jogador contra jogador. A taxa geral de gols caiu em relação ao MP-1 porque cruzamentos e dribles agora podem encerrar a chance antes do chute; isso é uma consequência causal esperada, não um redutor artificial de placar.

Esses números são baseline de engenharia, não calibração comercial definitiva. Ligas, estilos, níveis técnicos e táticas ainda receberão distribuições próprias nas fases seguintes.

## Limites conhecidos

- funções, familiaridade, traços e instruções completas ficam para MP-3;
- faltas, cartões, impedimentos e bolas paradas ficam para MP-4;
- rebotes ainda encerram a posse nesta fatia e serão encadeados numa fase posterior;
- pressão defensiva coletiva ainda usa aproximações, antes do plano tático completo;
- o motor novo continua isolado e não altera saves nem partidas da carreira atual.
