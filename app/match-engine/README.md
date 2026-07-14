# Motor de partida vNext — MP-0/MP-1

Este diretório contém o novo núcleo causal do Eterno FC. Ele roda em paralelo ao motor legado; ainda não decide as partidas da carreira do usuário.

## Verdades do núcleo

- toda partida começa em 0–0, sem placar previamente escolhido;
- `EventLedger` é a única fonte oficial de acontecimentos confirmados;
- estatísticas e placar são reconstruídos dos eventos;
- a mesma entrada, versão e semente reproduzem o mesmo ledger;
- somente atributos pertinentes participam de cada resolução;
- força aumenta probabilidade, nunca garante vitória;
- apresentação, campinho e narração não podem alterar o resultado.

## Conteúdo desta fatia

- contratos de jogador, equipe, tática, contexto, estado e evento;
- 12 atributos essenciais na escala interna de 1 a 100;
- RNG com semente e rastros auditáveis;
- ledger imutável, sequencial e causal;
- posses com passe, falha, interceptação, chute, defesa e gol;
- projeção de posse, passes, finalizações, defesas e gols;
- dois times fictícios de onze jogadores para a prova funcional;
- testes de replay, causalidade, isolamento de atributos e sensibilidade;
- harness para simulação em massa.

## Limite de integração

O próximo passo só substituirá o motor legado depois que esta fatia estiver calibrada e receber um adaptador explícito. Até lá, nenhum save existente ou resultado da interface é alterado.

## Calibração

```bash
npm run calibrate:match-engine -- 10000
```

O comando informa distribuição de resultados, médias, extremos e repetibilidade para detectar regressões antes da integração visual.
