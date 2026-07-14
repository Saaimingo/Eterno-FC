# Eterno FC — Peru, Bolívia e Venezuela

Terceiro e último bloco de fichas domésticas sul-americanas. Estes países concluem as dez associações necessárias para o motor continental.

## Peru

- A Federação Peruana trabalha com uma pirâmide ampla: Liga 1, Liga 2, Liga 3 e Copa Perú.
- Liga 3 e Copa Perú não são decoração: elas participam da rota de acesso e precisam existir pelo menos como camadas simuladas, mesmo quando somente as duas primeiras divisões forem jogáveis no lançamento.
- Os regulamentos são publicados por competição e devem fornecer fases, clubes elegíveis, ascenso e descenso da temporada-modelo.
- A classificação continental precisa de ficha nacional própria, ligada a liga, copas e tabela anual conforme regulamento vigente.

**Decisão técnica:** o Peru exige uma pirâmide com `League1`, `League2`, `League3` e `NationalAmateurCup`, com regras de elegibilidade e promoção parametrizadas.

## Bolívia

- A Divisão Profissional, as competições de copa e a segunda camada precisam ser cadastradas a partir do regulamento FBF da temporada.
- O país deve gerar classificados para ambas as copas CONMEBOL e manter rotas de acesso/descenso internas.
- Como o formato boliviano pode alternar entre torneio de liga, grupos e copa, o motor deve usar uma composição de fases, e não assumir pontos corridos perpétuos.

**Decisão técnica:** a Bolívia será registrada como `ConfigurableSeason`, com fases e rotas de vaga definidas exclusivamente no arquivo de regras da temporada. O regulamento oficial de 2026 é pendência antes da implementação.

## Venezuela

- A Liga FUTVE administra primeira e segunda divisão profissionais.
- A primeira divisão utiliza Torneo Apertura e Torneo Clausura, exigindo temporada dividida e fase final correspondente.
- A segunda divisão de 2026 é regionalizada em grupos, portanto não pode ser simulada como uma tabela nacional única.
- Campeões, tabela anual e critérios do regulamento nacional entregam as vagas CONMEBOL.

**Decisão técnica:** a Venezuela exige `SplitSeason` na primeira divisão e `RegionalGroups` na segunda, com classificadores nacionais para fases finais e continental.

## Fechamento da América do Sul

As dez associações CONMEBOL agora possuem arquitetura de competição definida. O trabalho restante é preencher, a partir dos regulamentos oficiais, cada ficha anual com participantes, fases, desempates, datas, vagas e seed histórico.

## Fontes oficiais

- [Regulamentos FPF](https://fpf.org.pe/wp-content/uploads/2025/02/Reglamento-Liga1-Te-Apuesto-2025-v3.pdf)
- [Liga 3 Peruana](https://fpf.org.pe/la-liga-3-joma-2025-realizo-su-presentacion-de-formato-y-sorteo/)
- [Copa Perú](https://fpf.org.pe/wp-content/uploads/2025/05/REGLAMENTO-COPA-PERU-2025-APROBADO.pdf)
- [Liga FUTVE](https://ligafutve.org/)
- [Matriz CONMEBOL 2026](conmebol-matriz-regulamentos-2026.md)
