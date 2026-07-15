# Motor de partida vNext — MP-7 eliminatório

O MP-7 remove o último fallback deliberado do MP-6: partidas eliminatórias de jogo único agora podem terminar empatadas no tempo regulamentar sem receber um gol artificial. O próprio motor disputa a prorrogação e, se necessário, os pênaltis.

## Regra explícita por partida

`MatchRules.drawResolution` possui dois modos:

- `allow_draw` encerra a partida após 90 minutos e aceita igualdade;
- `extra_time_and_penalties` disputa dois períodos de 15 minutos e exige um vencedor.

O adaptador ativa a segunda opção apenas em mata-mata de jogo único. Ligas, fases de grupos e confrontos de ida e volta continuam seguindo suas próprias regras.

## Uma linha do tempo, cinco períodos possíveis

Os períodos 1 e 2 representam o tempo regulamentar; 3 e 4, a prorrogação; 5, a disputa por pênaltis. Gols na prorrogação continuam sendo eventos `goal` e alteram o placar oficial. Cobranças do desempate usam `shootout_kick` e nunca aumentam esse placar.

Cada cobrança registra:

- equipe, cobrador e goleiro;
- ordem e rodada da disputa;
- atributos pertinentes de cobrança e defesa;
- fadiga, pressão, probabilidade e rolagem determinística;
- resultado `scored`, `saved` ou `missed`;
- placar parcial da disputa.

O evento `shootout_end` confirma o vencedor. `MatchDecision` separa método, classificado, placar regulamentar, placar após a prorrogação e placar dos pênaltis.

## Integração com a carreira

`Fixture` persiste o placar de jogo, o vencedor, o método de decisão e, quando existir, o placar dos pênaltis. O avanço de copa lê primeiro o vencedor confirmado; assim, um 0 a 0 decidido por 5 a 4 não vira 1 a 0 nem classifica automaticamente o visitante.

A apresentação passa a durar 120 minutos quando existe prorrogação, narra as cobranças e exibe o placar dos pênaltis separado do placar principal.

## Segurança e aceite

- replay com entrada, versão e semente iguais permanece exato;
- o ledger aceita exatamente dois ou quatro encerramentos de período;
- `match_end` nasce do último período ou de `shootout_end`;
- toda cobrança preserva o placar de jogo;
- a disputa termina antecipadamente quando a diferença se torna inalcançável;
- morte súbita só decide após as duas equipes completarem a mesma quantidade de cobranças;
- o classificado persistido coincide com `MatchDecision.winnerTeamId`;
- gols, estatísticas e artilharia ignoram cobranças de desempate.
