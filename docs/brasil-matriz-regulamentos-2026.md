# Eterno FC — Matriz Brasil 2026

Base de pré-produção para o motor de calendário brasileiro. Os nomes das competições no produto serão autorais; a estrutura abaixo usa referências oficiais apenas para documentar a lógica da temporada-modelo.

## Princípio

O Brasil é uma rede de torneios. A classificação de um clube em estadual, regional e liga nacional altera os torneios que ele pode disputar na temporada seguinte. O motor deve tratar essas relações como dados versionados, nunca como condições fixas no código.

## Calendário-base de 2026

| Bloco | Jan | Fev | Mar | Abr–Out | Nov | Dez |
|---|---|---|---|---|---|---|
| Estaduais | início | término 8/3 | — | — | — | — |
| Série A | início 28/1 | em curso | em curso | em curso | em curso | término 2/12 |
| Série B | — | — | início 21/3 | em curso | término 28/11 | — |
| Série C | — | — | — | 5/4 a 25/10 | — | — |
| Série D | — | — | — | 5/4 a 13/9 | — | — |
| Copa nacional | — | início 18/2 | em curso | em curso | em curso | final 6/12 |
| Regionais | — | — | 25/3 | até 7/6 | — | — |

Fonte: [calendário e planejamento CBF 2026–2029](https://www.cbf.com.br/a-cbf/noticias/informes-cbf/a/cbf-anuncia-novo-calendario-do-futebol-profissional-masculino).

## Pirâmide nacional

### Série A

- 20 clubes; pontos corridos em 38 rodadas.
- O motor usa o formato de 2026 e uma ficha de classificação continental própria da temporada.
- É disputada durante praticamente todo o ano.

### Série B

- 20 clubes; formato nacional de pontos corridos.
- Acesso e descenso são parametrizados pela ficha de temporada, não embutidos no motor.

### Série C

- 20 clubes em 2026; competição de 5 de abril a 25 de outubro.
- O campeão garante entrada privilegiada na copa nacional seguinte.
- A CBF publicou ampliação para 24 clubes em 2027 e 28 em 2028; a linha do tempo 2026–2029 deve ser incluída no conjunto de regras do save.

### Série D — base simulada inicial

- Não é uma divisão inicialmente jogável, mas é indispensável para alimentar a Série C e sustentar clubes estaduais.
- Em 2026 possui 96 clubes, 16 grupos de seis e seis acessos para a Série C.
- Participação combina descendentes da Série C, vagas estaduais, desempenho anterior e ranking nacional de clubes.

## Estaduais — 27 módulos

- Todos os estados e Distrito Federal existem no mundo e possuem federação/competição estadual.
- Cada estadual deve ter sua própria ficha: clubes, formato, datas, vagas, desempates e critério de classificação.
- O calendário nacional reserva até 11 datas para os estaduais em 2026.
- O resultado estadual participa da distribuição de vagas da copa nacional conforme ranking das federações.

Não haverá uma regra genérica para todos os estaduais. O motor é comum; os regulamentos são módulos por federação.

## Regionais — três blocos funcionais

Os clubes em competições continentais não participam dos regionais no modelo 2026.

| Bloco do jogo | Estrutura-modelo de 2026 | Função |
|---|---|---|
| Nordeste | 20 clubes; vagas por campeão/vice estadual e ranking | competição forte do Nordeste; campeão entra em fase avançada da copa nacional seguinte |
| Norte/Centro-Oeste | 24 clubes em blocos Norte e Centro-Oeste; título regional integrado | amplia calendário de clubes dessas regiões e produz classificação para copa nacional |
| Sul/Sudeste | 12 clubes; fase de grupos, semifinal e final | calendário regional de Sul/Sudeste e classificação para copa nacional |

Os três blocos usam janela de 25 de março a 7 de junho em 2026. O produto precisa criar denominações, troféus e identidades próprias para essas competições.

## Copa nacional

Modelo 2026:

- 126 clubes e nove fases.
- 20 clubes da Série A entram na quinta fase.
- A distribuição inclui clubes classificados por estaduais/ranking de federações e campeões de regional/Séries C e D.
- Final em jogo único, no encerramento do calendário nacional.
- Para 2027, a CBF anunciou 128 clubes e entrada dos campeões dos três blocos regionais.

Consequência para o motor: a classificação da copa nacional é calculada a partir da temporada anterior. O save iniciado em janeiro de 2026 deve trazer uma tabela de classificação-semente de 2025; a partir de 2027, ela passa a ser inteiramente gerada pelo próprio universo.

## Supercopa nacional

- Partida única entre campeão da liga nacional e campeão da copa nacional da temporada anterior.
- Se o mesmo clube vencer ambas, a regra de substituição precisa ser registrada na ficha da temporada antes de gerar o calendário.

## Competições continentais e Mundial

- A rota brasileira para as copas continentais será cadastrada por temporada com base nos regulamentos CBF/CONMEBOL vigentes.
- Não se assume que título regional gera vaga continental; o regional alimenta a copa nacional e o calendário doméstico conforme a regra atual.
- Vagas continentais qualificam clubes para os torneios sul-americanos e, quando aplicável, para o Mundial de Clubes.

## Dados ainda necessários antes de implementar

1. Regulamento específico 2026 de cada uma das 27 federações estaduais.
2. Fichas formais de Série A e Série B, com acesso/descenso, desempates e critérios continentais.
3. Regras completas da classificação brasileira para torneios CONMEBOL em 2026.
4. Tabela-semente de classificados de 2025 para a primeira temporada do save.
5. Cronograma de mudanças já oficializadas para 2027–2029 e política do mundo para regras posteriores.

## Fontes oficiais consultadas

- [Novo calendário do futebol profissional masculino — CBF](https://www.cbf.com.br/a-cbf/noticias/informes-cbf/a/cbf-anuncia-novo-calendario-do-futebol-profissional-masculino)
- [Série C 2026 — documentos técnicos CBF](https://www.cbf.com.br/futebol-brasileiro/noticias/copa-do-brasil/sub-20/cbf-publica-documentos-tecnicos-da-serie-c-de-2026)
- [Copa Verde 2026 — documentos técnicos CBF](https://www.cbf.com.br/futebol-brasileiro/noticias/supercopa/sub20/cbf-publica-documentos-tecnicos-da-copa-verde-de-2026-2)
- [Copa Sul-Sudeste 2026 — documentos técnicos CBF](https://www.cbf.com.br/futebol-brasileiro/noticias/supercopa/sub20/cbf-publica-documentos-tecnicos-da-copa-sul-sudeste)
- [Supercopa 2026 — CBF](https://www.cbf.com.br/futebol-brasileiro/noticias/copa-nordeste/a/supercopa-rei-agora-e-supercopa-rei-superbet-2026)
