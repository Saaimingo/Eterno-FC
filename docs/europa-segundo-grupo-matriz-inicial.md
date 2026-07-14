# Eterno FC — Portugal, Holanda, Bélgica, Escócia e Turquia

Matriz inicial para o segundo grupo de países europeus jogáveis. Regras que dependem de licença, equipe B/sub-23 ou reformulação anual são dados de temporada, não condições permanentes no motor.

## Portugal

- Primeira divisão: 18 clubes, 34 rodadas.
- Segunda divisão: 18 clubes.
- Pirâmide precisa suportar dois acessos/descensos diretos e, quando previsto pelo regulamento anual, confronto de promoção/permanência entre as divisões.
- Copa nacional e supercopa entram no calendário e podem alterar a rota europeia.

## Holanda

- Primeira divisão: 18 clubes, 34 rodadas.
- Segunda divisão: 20 clubes.
- A pirâmide inclui acessos diretos e playoffs de promoção/permanência; a temporada holandesa também pode ter playoff doméstico por vaga europeia.
- Equipes de desenvolvimento na segunda divisão possuem restrições próprias de promoção e devem ser modeladas como `ineligible_for_promotion`, não removidas artificialmente da tabela.
- Copa nacional e supercopa compõem o calendário.

## Bélgica

- Primeira divisão de 2026/27: 18 clubes, 34 rodadas, sem playoffs; os dois últimos caem diretamente.
- A segunda divisão é variável (14, 15 ou 16 clubes no desenho aprovado) e inclui regras especiais para equipes sub-23.
- Equipes sub-23 não podem subir; quantidade e descenso dependem do quota anual.
- Copa nacional e supercopa fazem parte das rotas domésticas.

Este é o melhor exemplo de por que o formato deve ser versionado: a Bélgica saiu do sistema de playoffs da elite e passou a uma liga clássica em 2026/27.

## Escócia

- Primeira divisão: 12 clubes.
- Após 33 jogos, a liga se divide em grupo superior e inferior, cada um com seis clubes; cada clube joga mais cinco partidas, totalizando 38.
- A tabela final deve respeitar a divisão: clube da metade inferior não ultrapassa clube da metade superior após o corte.
- O último colocado cai diretamente e o penúltimo disputa playoff de permanência contra o vencedor do caminho da segunda divisão.
- Copa nacional, copa da liga e supercopa entram no calendário e nas rotas europeias.

## Turquia

- Primeira divisão: 18 clubes, 34 rodadas.
- Três clubes sobem da segunda divisão e três caem, conforme o modelo de 2025/26 e a redução oficial para 18 participantes.
- Copa nacional e supercopa devem ser integradas às rotas europeias.
- Limites de elenco estrangeiro e outras regras de inscrição são dados de temporada, separados da força do atleta no motor.

## Requisitos comuns antes de implementar

1. Regulamentos oficiais completos de liga, segunda divisão e copas para 2026/27.
2. Fichas de vagas europeias ligadas à lista de acesso UEFA da temporada.
3. Regras de clubes B/sub-23 e licenciamento, especialmente Holanda e Bélgica.
4. Datas detalhadas de janelas, copas e playoffs.
5. Estado-semente 2025/26 para a carreira iniciada em janeiro de 2026.

## Fontes de partida

- [Liga Portugal — 18 clubes em cada uma das duas primeiras divisões](https://europeanleagues.com/member/liga-portugal/)
- [Calendário e playoffs holandeses](https://eredivisie.com/news/the-match-schedule-for-the-2025-26-season-has-been-confirmed/)
- [Reforma belga para 2026/27](https://www.proleague.be/fr/informations/format-18-clubs-en-jupiler-pro-league-a-partir-de-la-saison-26-27)
- [Calendário da Süper Lig e 18 clubes — TFF](https://www.tff.org/default.aspx?ftxtID=47944&pageID=201)
- [Matriz continental UEFA 2026/27](uefa-matriz-regulamentos-2026-27.md)
