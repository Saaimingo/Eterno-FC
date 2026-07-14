# Eterno FC — Arquitetura Técnica Proposta v1

Objetivo: transformar a Bíblia do Jogo em uma base modular, testável e leve. Este documento não implementa telas nem funcionalidades; ele define como o código deve ser organizado antes da refatoração/construção.

## 1. Princípios inegociáveis

1. **Motor independente da interface.** Uma partida, uma temporada ou uma década devem poder ser simuladas sem navegador, tela ou componente visual.
2. **Regras como dados.** Países, divisões, vagas, formatos e calendários vivem em pacotes de regulamento versionados; não em `if` espalhado pelo código.
3. **Determinismo.** Cada mundo recebe uma semente. Com a mesma semente, regras e decisões, o resultado é reproduzível para teste e correção.
4. **Estado serializável.** Um save precisa ser salvo, migrado, carregado e ampliado sem depender de objetos de interface.
5. **Profundidade sem burocracia.** O motor pode ser rico; o usuário só vê controles que criam decisão de treinador.
6. **Camada autoral separada.** Nomes, símbolos, textos, cores e possíveis pacotes oficiais são conteúdo substituível, nunca regra do motor.

## 2. Camadas

```text
Interface (desktop / celular / web)
            ↓
Casos de uso da aplicação
            ↓
Motor de domínio: mundo, calendário, competição, partida, mercado
            ↓
Persistência, pacotes de dados, geração aleatória e integrações
```

### Interface

Mostra informações e envia intenções: avançar tempo, escalar, negociar, alterar tática, aceitar proposta. Não calcula tabela, vaga, resultado nem atributo.

### Casos de uso

Orquestram ações como `avançar até a próxima partida`, `enviar proposta`, `resolver fim de temporada` e `simular rodada`. Chamam o motor e retornam uma visão pronta para a interface.

### Domínio

Contém regras puras e testáveis. Não conhece React, HTML, armazenamento local, aplicativo móvel ou banco de dados.

### Infraestrutura

Lê/grava saves, carrega conteúdo, fornece relógio, números aleatórios determinísticos e adapta o jogo para cada plataforma.

## 3. Módulos do domínio

| Módulo | Responsabilidade |
|---|---|
| Mundo | data global, seed, entidades e histórico |
| Calendário | agenda diária, janelas, pausas e conflitos |
| Regulamentos | definição de países, competições, fases, vagas e desempates |
| Competições | tabelas, grupos, chaves, classificação e premiação |
| Vagas | acesso, descenso, copas domésticas e vagas continentais |
| Clubes | caixa, reputação, metas, contratos e elenco |
| Atletas | atributos, evolução, aposentadoria e base |
| Partidas | escalação, tática, eventos, placar e estatísticas |
| Mercado | propostas, empréstimos, interesse, contratos e leilões |
| Treinadores | carreira, empregos, disponibilidade e reputação |
| Notícias | fatos do mundo convertidos em manchetes autorais |
| Economia | receitas, salários, orçamento e efeito de acesso/descenso |

Nenhum módulo deve importar diretamente a interface ou manipular armazenamento do dispositivo.

## 4. Entidades principais

```text
WorldState
 ├─ worldId, seed, currentDate, schemaVersion
 ├─ clubs, players, managers, contracts
 ├─ competitions, seasonInstances, standings
 ├─ fixtures, matchResults, transferOffers
 ├─ financeLedgers, boardAssessments
 └─ history, newsEvents

RulePack
 ├─ country / federation / season
 ├─ competition definitions and phases
 ├─ qualification and relegation rules
 ├─ calendar windows and registration rules
 └─ tie-breakers and prize/economic parameters

ContentPack
 ├─ club identity, kits, texts and colors
 ├─ player naming/generation vocabulary
 └─ optional future licensed data
```

`RulePack` não é `ContentPack`: trocar uma identidade de clube não altera tabela, calendário ou vagas.

## 5. Ciclo diário do mundo

1. O jogador pede avanço de tempo.
2. O calendário retorna os eventos do próximo dia relevante.
3. O motor resolve eventos na ordem: fim de janela, inscrições, propostas, partidas, lesões, classificação, notícias e gatilhos de diretoria.
4. Cada resultado gera fatos estruturados, por exemplo `PlayerScoredHatTrick` ou `ClubQualifiedForContinentalCup`.
5. Notícias, alertas e telas consomem esses fatos sem recalcular o jogo.
6. O mundo é salvo por snapshot em pontos seguros.

Partidas do usuário usam simulação detalhada por eventos. Partidas externas usam a mesma lógica de força/tática, mas com resolução agregada, preservando resultado, estatísticas e destaques sem custar renderização.

## 6. Motor de calendário e vagas

O motor precisa receber uma `SeasonInstance` e um `RulePack` e produzir:

- lista de participantes;
- fases e partidas;
- classificação e desempates;
- promovidos/rebaixados;
- classificados para cada competição seguinte;
- valores de premiação e impacto econômico.

Vagas são objetos explícitos, não números ocultos:

```text
QualificationSlot
 ├─ destino: competição + fase + temporada
 ├─ origem: campeão, posição, copa, ranking ou herdada
 ├─ prioridade e condição de elegibilidade
 └─ regra de substituição se a vaga duplicar
```

Isso resolve Brasil, CONMEBOL, UEFA e futuras mudanças de regulamento pelo mesmo mecanismo.

## 7. Motor de partidas

- Entrada: escalação, banco, formação, tática, condição, moral, contexto e seed da partida.
- Processo: sequência de posses e eventos coerentes com zona, jogador, função e probabilidade.
- Saída: placar, timeline, estatísticas, cartões, lesões, avaliações e fatos de notícia.
- O campo 2D é uma visualização da timeline; ele não é a fonte da verdade da partida.

O motor deve ser calibrado por testes estatísticos: times superiores vencem mais no longo prazo, mas zebras e jogos ruins continuam possíveis.

## 8. Saves, versões e expansões

- Cada save tem `schemaVersion`, `contentPackVersion` e lista de `rulePackVersion` usados.
- Snapshot completo em formato estável e migrável.
- Histórico semântico de títulos, transferências, recordes e acontecimentos relevantes.
- Atualização de conteúdo não pode alterar retroativamente o passado de um save.
- Liga nova entra por pacote: entidades novas, regras novas e ponto de entrada de calendário definido.
- Upgrade gratuito → completo ativa recursos no próximo marco de calendário compatível, sem inserir partidas antigas no passado.

## 9. Plataforma

O núcleo deve ser uma biblioteca TypeScript sem interface. Em volta dele:

- aplicativo web/desktop usa adaptador de armazenamento local e, futuramente, empacotamento desktop;
- aplicativo móvel usa o mesmo núcleo e adaptador de armazenamento/compra da loja;
- testes executam o núcleo diretamente, sem abrir aplicativo.

A escolha final de framework da interface vem depois da revisão da base existente; ela não pode contaminar o motor.

## 10. Estratégia de testes

1. **Unitários:** desempate, acesso, vaga duplicada, contrato, evolução e eventos de partida.
2. **Propriedades:** nenhuma partida duplicada; nenhum clube joga duas vezes no dia; toda vaga é preenchida; totais de classificação fecham.
3. **Simulações longas:** 10, 50 e 100 temporadas com seed fixa, verificando população de atletas, finanças, tabelas e calendário.
4. **Migrações:** abrir saves antigos após atualizar regra, conteúdo ou aplicativo.
5. **Interface:** o painel apenas apresenta estados e ações aprovadas pelo domínio.

## 11. Ordem de implementação

1. Tipos de domínio, seed determinística e persistência de mundo vazio.
2. Motor de regulamentos com uma competição simples de teste.
3. Calendário, tabela, acesso/descenso e vagas entre competições.
4. Clubes, atletas, elenco e economia básica.
5. Motor de partidas e tática.
6. Mercado, carreira de treinador, notícias e histórico.
7. Interface redesenhada para desktop e celular.
8. Expansão de dados para os 20 países e validações de longas temporadas.

## 12. Critério de qualidade

Antes de chamar qualquer versão de pronta, ela deve conseguir simular muitas temporadas sem conflito de calendário, sem vaga vazia, sem quebra de save e sem colapso de população de atletas. Interface bonita sem essas garantias não é produto pronto.
