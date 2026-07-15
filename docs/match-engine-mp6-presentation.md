# Motor de partida vNext — MP-6 na apresentação 2D

O MP-6 faz a primeira promoção controlada do motor causal. Em partidas elegíveis do usuário, a timeline vNext deixa de ser apenas observada: ela passa a decidir o resultado oficial e a alimentar a experiência visível da partida.

## Uma única verdade

O `EventLedger` continua sendo a fonte oficial. A camada de apresentação não sorteia, corrige nem inventa lances. Ela transforma eventos canônicos em quatro projeções sincronizadas:

1. placar e estatísticas;
2. posição da bola, portador e zona no campinho;
3. narração textual e trilho de incidentes;
4. celebração de gol com autor, assistência e placar após o lance.

Assim, o gol não aparece primeiro no placar nem a bola volta ao meio sem explicação. O evento chega à interface, atualiza o placar, mantém a bola no destino do lance e pausa o relógio visual durante a celebração. Só depois a partida prossegue.

## Portão de promoção

Antes de usar o candidato como resultado oficial, a integração confirma:

- o último evento é `match_end`;
- o placar final do ledger coincide com o estado final;
- a quantidade de eventos `goal` coincide com a soma do placar;
- as estatísticas reconstruídas registram os mesmos gols;
- a regra da competição já pode encerrar aquela partida com esse resultado.

Se qualquer condição falhar, a partida usa o plano legado já calculado. A falha candidata fica contida e a carreira continua normalmente.

### Exceção deliberada

Um empate em mata-mata de jogo único ainda exige uma regra de desempate ausente no núcleo vNext. Nesse caso específico, o MP-6 não promove o candidato. Prorrogação e disputa por pênaltis formarão um marco próprio; até lá, o fallback preserva a obrigação de existir um vencedor.

## Projeção do campinho

Cada minuto recebe uma fase derivada do evento causal mais recente:

- clube com a posse;
- zona de saída, construção ou ataque;
- atleta portador, quando identificado;
- coordenada da bola normalizada e espelhada para o sentido correto;
- referência ao evento canônico que originou a fase.

Os 22 jogadores permanecem leves — marcadores 2D, sem física ou renderização 3D — e se deslocam em torno da formação. A bola, os destaques e o texto são dirigidos pela timeline, mantendo desempenho em celular sem sacrificar legibilidade.

## Ritmo e gol

As quatro velocidades agora representam experiências diferentes:

| Velocidade | Duração aproximada sem pausas | Celebração de gol |
|---|---:|---:|
| Lenta | 59 s | 3,0 s |
| Normal | 23 s | 2,2 s |
| Rápida | 8 s | 1,3 s |
| Ultra | 2 s | 0,8 s |

A celebração interrompe apenas a revelação visual, não recalcula o motor. Em velocidade lenta há tempo para ler e acompanhar o lance; no modo ultra a confirmação continua inequívoca sem bloquear quem quer avançar rapidamente.

## Narração

A narração textual usa tipo, resultado, tags, ator, alvo, equipe e cadeia de causas. Num gol, por exemplo, ela procura o último passe ou cruzamento válido na cadeia causal para identificar a assistência. Faltas, cartões, impedimentos, defesas, rebotes, escanteios, pênaltis, substituições e mudanças táticas recebem tratamentos próprios.

Narração por voz ou IA não faz parte deste marco. O contrato preparado aqui permite acrescentá-la no futuro como outra projeção somente de leitura, recebendo os fatos fechados do ledger sem poder alterar o jogo.

## Testes de aceite

- todo gol canônico aparece uma vez na apresentação;
- último `scoreAfter` de gol coincide com o placar final;
- cada partida promovida possui 90 fases visuais válidas;
- coordenadas permanecem dentro do campo;
- build, persistência e encerramento usam o mesmo placar;
- empate eliminatório sem regra de desempate não é promovido;
- replay com a mesma entrada continua determinístico.
