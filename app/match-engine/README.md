# Motor de partida vNext — MP-0 a MP-2

Este diretório contém o novo núcleo causal do Eterno FC. Ele roda em paralelo ao motor legado; ainda não decide as partidas da carreira do usuário.

## Verdades do núcleo

- toda partida começa em 0–0, sem placar previamente escolhido;
- `EventLedger` é a única fonte oficial de acontecimentos confirmados;
- estatísticas e placar são reconstruídos dos eventos;
- a mesma entrada, versão e semente reproduzem o mesmo ledger;
- somente atributos pertinentes participam de cada resolução;
- capacidade, escolha, execução, oposição e resultado são dimensões separadas;
- força aumenta probabilidade, nunca garante vitória;
- apresentação, campinho e narração não podem alterar o resultado.

## Conteúdo entregue

- contratos de jogador, equipe, tática, contexto, estado e evento;
- 47 atributos técnicos, mentais, físicos e de goleiro na escala de 1 a 100;
- proficiência independente dos pés esquerdo e direito na escala interna de 0 a 1000;
- altura, massa, condição, fadiga dinâmica e pressão contextual;
- RNG com semente e rastros auditáveis;
- ledger imutável, sequencial e causal;
- posses com passe, interceptação, chute, defesa e gol;
- drible contra desarme, cruzamento, disputa aérea e intervenção do goleiro;
- cabeceio técnico separado da capacidade de ganhar a bola no alto;
- estatísticas reconstruídas para todos os confrontos confirmados;
- testes de replay, causalidade, isolamento, fadiga, pés e especialistas;
- calibradores geral e de perfis especialistas.

## Limite de integração

O motor só substituirá o legado depois de receber tática/funções no MP-3, regras essenciais nas fases seguintes e um adaptador explícito. Até lá, nenhum save existente ou resultado da interface é alterado.

## Calibração

```bash
npm run calibrate:match-engine -- 10000
npm run calibrate:match-engine:specialists -- 1000
```

Os comandos informam distribuição de resultados, ações, fadiga, repetibilidade e diferenças mensuráveis de especialistas antes da integração visual.
