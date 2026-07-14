# Eterno FC — Uruguai, Paraguai e Equador

Segundo bloco de fichas domésticas sul-americanas. A prioridade é manter as particularidades que alteram calendário, classificação continental e movimento econômico.

## Uruguai

- O ecossistema AUF possui primeira divisão, segunda profissional, divisões de acesso e copa nacional próprias.
- A segunda divisão profissional de 2026 está ativa e precisa alimentar a primeira por regras de acesso/promoção registradas na ficha da temporada.
- O calendário deve suportar a estrutura de torneios internos da primeira divisão e a copa nacional, sem reduzir o país a uma liga genérica.
- A rota de vagas CONMEBOL precisa ser extraída do manual AUF específico da temporada e ligada à matriz continental.

**Decisão técnica:** o Uruguai recebe módulos independentes para primeira divisão, segunda profissional e copa, com uma tabela de classificação continental anual. O regulamento de disputa da primeira divisão 2026 é pendência obrigatória antes da codificação.

## Paraguai

- Divisão de Honor com 12 clubes.
- Dois campeonatos anuais de igual hierarquia: Apertura e Clausura, ambos em formato de liga de 22 rodadas.
- Campeões de Apertura e Clausura, tabela acumulada e copa nacional compõem as rotas continentais.
- Os dois últimos na tabela de média de pontos de três anos descem à Intermedia; campeão e vice da Intermedia sobem diretamente.
- Copa nacional e Supercopa são competições formais do calendário.

**Decisão técnica:** o Paraguai exige `SplitSeason` + `AggregateTable` + `ThreeYearAverageTable`. A média de descenso não pode ser calculada apenas com a temporada atual.

## Equador

- LigaProf organiza Série A e Série B.
- A Série A possui 16 clubes conforme o regulamento de competições disponível; seu sistema é de múltiplas fases e deve ser carregado da versão anual do regulamento, inclusive critérios de títulos, vagas e descenso.
- A Série B é uma entidade própria e alimenta o acesso/descenso.
- Regras de clube filial, licenciamento e inscrição aparecem no regulamento e precisam ser dados separados do motor de partidas.
- A rota de classificação CONMEBOL é fornecida pela tabela da temporada e pelo regulamento nacional aplicável.

**Decisão técnica:** o Equador recebe `MultiPhaseLeague` para Série A e `SecondDivision` própria; fases e pesos não devem ser simplificados para pontos corridos sem validação oficial da edição.

## Dados obrigatórios antes de codificar o bloco

1. Regulamento de primeira divisão uruguaia 2026 e rotas de vagas AUF.
2. Ficha anual paraguaia de Apertura/Clausura, Copa e tabela de médias.
3. Regulamento LigaPro 2026 completo, incluindo as fases da Série A, acesso/descenso e classificação internacional.
4. Estado-semente 2025 para a carreira iniciada em janeiro de 2026.

## Fontes oficiais

- [Regulamentos AUF](https://www.auf.org.uy/reglamentos/)
- [Segunda Divisão Profissional AUF](https://www.auf.org.uy/segunda-division-profesional/)
- [Copa de Primeira 2026 — APF](https://www.apf.org.py/torneo-clausura)
- [Regulamento geral de competições APF](https://sistema.apf.org.py/laravel-filemanager/files/69/5e21bd153b99b.pdf)
- [Regulamento de competições LigaPro](https://ligapro.ec/wp-content/uploads/2024/07/Reglamento-Competiciones-ed.-2025.pdf)
- [LigaPro — competições 2026](https://ligapro.ec/)
- [Matriz CONMEBOL 2026](conmebol-matriz-regulamentos-2026.md)
