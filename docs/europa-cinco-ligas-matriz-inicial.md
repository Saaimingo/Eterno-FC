# Eterno FC — Cinco Grandes Ligas Europeias

Matriz inicial de dados domésticos para Inglaterra, Espanha, Itália, Alemanha e França. Ela descreve somente a camada necessária no lançamento; regras de desempate, licenciamento, calendários detalhados e redistribuição de vagas permanecem em fichas de temporada separadas.

## Regra comum

- Temporada europeia atravessa dois anos, em geral de agosto a maio.
- Cada país entrega vagas à camada UEFA por uma rota doméstica versionada.
- Posição de liga, campeão de copa, campeão continental e coeficientes UEFA podem alterar a distribuição final.
- O motor nunca fixa “posição X sempre vai para torneio Y”; consulta a lista de acesso UEFA da temporada.

## Inglaterra

| Camada | Formato inicial |
|---|---|
| Primeira divisão | 20 clubes, turno e returno; três descensos diretos |
| Segunda divisão | 24 clubes; dois acessos diretos e playoff entre 3º e 6º para o terceiro acesso |
| Copa nacional | mata-mata nacional |
| Copa da liga | mata-mata dos clubes profissionais elegíveis |
| Supercopa | campeão da liga x campeão da copa nacional |

As duas copas entram na rota continental e exigem regra de redistribuição se o campeão já estiver classificado pela liga. Os playoffs da segunda divisão são disputados pelos quatro clubes imediatamente abaixo das vagas automáticas.

## Espanha

| Camada | Formato inicial |
|---|---|
| Primeira divisão | 20 clubes, turno e returno; três descensos diretos |
| Segunda divisão | 22 clubes, 42 rodadas; dois acessos diretos e playoff para o terceiro acesso |
| Copa nacional | mata-mata nacional |
| Supercopa | competição curta entre classificados domésticos da temporada anterior |

A segunda divisão espanhola exige calendário de 42 rodadas. A rota de classificação europeia é separada da copa e da tabela da liga conforme a lista de acesso UEFA aplicável.

## Itália

| Camada | Formato inicial |
|---|---|
| Primeira divisão | 20 clubes, turno e returno; três descensos diretos |
| Segunda divisão | 20 clubes; acessos/descensos e playoffs definidos na ficha anual da competição |
| Copa nacional | mata-mata nacional |
| Supercopa | competição curta entre campeões e posições qualificadas da temporada anterior |

A Série A de 2026/27 foi anunciada para começar em 22–23 de agosto de 2026 e terminar em 29–30 de maio de 2027. A ficha de calendário precisa também tratar pares de clubes da mesma cidade e alternância de mandos quando exigida.

## Alemanha

| Camada | Formato inicial |
|---|---|
| Primeira divisão | 18 clubes, turno e returno; dois descensos diretos e playoff para o 16º |
| Segunda divisão | 18 clubes; dois acessos diretos e playoff para o 3º |
| Copa nacional | mata-mata nacional |
| Supercopa | campeão da liga x campeão da copa nacional |

O playoff entre primeira e segunda divisão é parte material da pirâmide alemã e precisa aparecer no calendário antes da definição final de vagas e orçamento da temporada seguinte.

## França

| Camada | Formato inicial |
|---|---|
| Primeira divisão | 18 clubes, turno e returno; descensos e playoff de permanência definidos pela ficha anual |
| Segunda divisão | 18 clubes; acessos diretos e rota de playoff de promoção/permanência |
| Copa nacional | mata-mata nacional |
| Supercopa | campeão da liga x campeão da copa nacional |

A estrutura francesa usa playoffs de promoção: clubes na faixa de playoff da segunda divisão disputam vagas e o vencedor enfrenta o clube de primeira divisão indicado pelo regulamento anual.

## Itens obrigatórios antes de implementar

1. Carregar regulamento e calendário oficiais da temporada para cada liga e copa.
2. Preencher desempates, critérios de licenciamento e exceções de acesso/descenso.
3. Construir rotas domésticas de qualificação UEFA usando a lista de acesso anual.
4. Tratar vaga de copa duplicada, campeão continental e vaga extra por desempenho UEFA.
5. Incluir o estado-semente 2025/26 para o save iniciado em janeiro de 2026.

## Fontes de partida

- [Playoffs da EFL](https://efl.com/competitions/sky-bet-play-offs/about-the-play-offs)
- [Informações e regras da Premier League](https://www.premierleague.com/en/news/4365156/premier-leagues-beginners-guide-all-you-need-to-know)
- [Calendário da Segunda Divisão espanhola 2026/27](https://rfef.es/es/noticias/calendario-completo-segunda-division-temporada-202627)
- [Calendário da Serie A 2026/27](https://en.legaseriea.it/serie-a/news/looking-forward-to-the-2026-27-serie-a-fixture-list)
- [Estrutura de playoffs da Ligue 2](https://ligue1.com/en/articles/l1_article_4958-ligue-2-bkt-who-are-the-ligue-1-promotion-candidates)
- [Matriz continental UEFA 2026/27](uefa-matriz-regulamentos-2026-27.md)
