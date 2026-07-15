# Motor de partida vNext — MP-0 a MP-8

Este diretório contém o novo núcleo causal do Eterno FC. Desde o MP-6, ele decide partidas elegíveis da carreira do usuário e alimenta diretamente o campinho 2D, a narração, as estatísticas e o placar.

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
- banco de reservas e escalação com posição, função e instruções por atleta;
- 18 funções, 21 traços de escolha e familiaridade posicional/tática;
- plano coletivo com mentalidade, risco, ritmo, largura, linhas, pressão, passe, foco, transição e liberdade;
- substituições, mudanças de função, posição e plano durante a partida;
- intervenções registradas no ledger que alteram somente acontecimentos futuros;
- perfil de árbitro e regras configuráveis por competição;
- faltas contextuais, amarelos, segundo amarelo, vermelho direto e expulsão efetiva;
- impedimentos sensíveis a risco, movimento, passe e altura da linha defensiva;
- faltas diretas, escanteios e pênaltis resolvidos pelos atributos pertinentes;
- rebotes encadeados à defesa que os originou, com uma segunda bola limitada;
- acréscimos calculados por incidentes e convertidos em posses extras auditáveis;
- prorrogação com dois períodos de 15 minutos e disputa por pênaltis registrada cobrança a cobrança;
- decisão eliminatória separada do placar de jogo, sem transformar pênalti de desempate em gol oficial;
- área técnica ao vivo com quatro comandos táticos e substituições escolhidas pelo treinador;
- re-simulação determinística protegida por comparação do prefixo já revelado: decisão nova nunca reescreve o passado;
- adaptador da carreira, comparação em modo sombra e portão de promoção por partida;
- projeção da timeline canônica no campinho 2D, com portador, bola, zona e sentido do ataque;
- narração derivada dos eventos e das relações causais, inclusive assistência;
- coreografia de gol com pausa proporcional à velocidade, rede, autor, assistência e placar confirmado;
- trilho de incidentes e feed de faltas, cartões, impedimentos, defesas, escanteios, pênaltis e substituições;
- fallback isolado para o motor legado quando o candidato falha;
- estatísticas reconstruídas para todos os confrontos confirmados;
- testes de replay, causalidade, isolamento, fadiga, pés, especialistas, tática, substituição e regras;
- calibradores geral, de especialistas, de decisões do treinador e de arbitragem/regras.

## Integração atual

O portão de promoção valida o fim do ledger, o placar, a quantidade de gols, as estatísticas e a decisão eliminatória. Quando ele passa, o placar vNext é o resultado gravado na carreira e a interface apenas o revela no tempo certo.

Desde o MP-7, um empate em mata-mata de jogo único abre a prorrogação no mesmo ledger. Persistindo a igualdade, `shootout_kick` registra cada cobrador, goleiro, pressão, probabilidade e resultado; `shootout_end` confirma o classificado. O placar de jogo permanece separado do placar dos pênaltis. Saves existentes permanecem compatíveis.

No MP-8, o treinador pode fechar a casa, reequilibrar, pressionar, explorar os lados ou substituir atletas durante a exibição. Cada escolha vira uma intervenção canônica agendada depois do último minuto revelado. O motor repete a mesma entrada e a mesma sequência aleatória até aquele instante, confirma que o prefixo visível permaneceu idêntico e só então troca a continuação da partida.

## Calibração

```bash
npm run calibrate:match-engine -- 10000
npm run calibrate:match-engine:specialists -- 1000
npm run calibrate:match-engine:tactics -- 1000
npm run calibrate:match-engine:rules -- 1000
npm run calibrate:match-engine:shadow -- 500
```

Os comandos informam distribuição de resultados, ações, fadiga, repetibilidade, diferenças de especialistas, sensibilidade às decisões do treinador e frequência das regras antes da integração visual.
