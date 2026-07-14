# Eterno FC — Argentina, Chile e Colômbia

Primeiro bloco de fichas domésticas sul-americanas. A regra é preservar o formato oficial do ano-modelo e permitir que cada associação entregue vagas à matriz CONMEBOL sem generalizações.

## Argentina

- A primeira divisão de 2026 possui regulamento próprio da AFA e estrutura de torneios da temporada, não uma simples liga europeia de turno e returno.
- O motor precisa representar as etapas e tabelas previstas pelo regulamento AFA 2026, incluindo classificação geral da temporada, torneios de copa e critérios de acesso/descenso.
- Copa nacional e demais campeões domésticos alimentam a tabela argentina de vagas continentais.
- As seis vagas-base argentinas para a competição continental principal e as seis para a secundária devem ser preenchidas pelo `ArgentinaQualificationRuleSet`, tratando duplicidade de títulos e tabela geral.

**Decisão técnica:** a Argentina recebe um `MultiTournamentSeason` (mais de um torneio principal no mesmo ano), e não o modelo padrão de liga simples.

## Chile

- A ANFP publicou bases independentes para Primeira Divisão, Ascenso, copa nacional, copa da liga e supercopa em 2026.
- A primeira divisão e o Ascenso precisam ser fichas distintas, com suas próprias vagas, descensos e critérios de desempate.
- A criação/uso de Copa da Liga e novo formato de Supercopa torna o calendário chileno mais denso que o antigo modelo “liga + copa”.
- A distribuição de vagas continentais foi atualizada para 2026 e deve ser consumida diretamente das bases da ANFP, não inferida da tabela anterior.

**Decisão técnica:** o Chile exige `League`, `SecondDivision`, `NationalCup`, `LeagueCup` e `SuperCup` como competições independentes e ligadas por uma regra de vagas anual.

## Colômbia

- A DIMAYOR possui regulamentos independentes para Liga, Torneo de acesso, Copa e Superliga.
- A temporada é composta por dois torneios de liga (I e II), além de tabela de reclassificação e tabela de descenso, todos relevantes para vagas e acesso/descenso.
- Copa nacional e Superliga são competições separadas e devem entrar no calendário.
- A regra de vagas para CONMEBOL é calculada pela combinação dos campeões e da reclassificação, com redistribuição se houver duplicidade.

**Decisão técnica:** a Colômbia exige `SplitSeason` com dois campeonatos, tabela agregada/reclassificação e tabela de descenso persistente; não se pode decidir vaga continental olhando somente o campeão de uma fase.

## Dados obrigatórios antes de codificar o bloco

1. Extrair dos regulamentos de 2026 todas as fases, participantes, desempates, acesso e descenso.
2. Registrar a ordem formal de vagas continentais e o tratamento de campeão duplicado.
3. Carregar a tabela-semente 2025 para a carreira iniciada em janeiro de 2026.
4. Cadastrar datas-base, janelas e incompatibilidades de calendário.

## Fontes oficiais

- [Regulamento da primeira divisão argentina 2026 — AFA](https://assets1.afa.com.ar/2026/BOLETINES/Boletin-Resoluciones-6818---Complementario-01---Reglamento-Torneos-LPF-Primera-2026.pdf)
- [Bases de campeonatos 2026 — ANFP](https://www.anfp.cl/bases/)
- [Bases da primeira divisão chilena 2026 — ANFP](https://www.anfp.cl/?jet_download=52fbfdcaf815f14368bd4dd66b095f04f533b6cc)
- [Regulamento da Liga Colombiana 2026 — DIMAYOR](https://dimayor.com.co/wp-content/uploads/2026/01/REGLAMENTO-LIGA-2026-V12.pdf)
- [Regulamentos DIMAYOR](https://www.dimayor.com.co/)
- [Matriz CONMEBOL 2026](conmebol-matriz-regulamentos-2026.md)
