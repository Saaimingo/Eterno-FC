# Eterno FC — Matriz CONMEBOL 2026

Base de pré-produção para a camada continental sul-americana. O produto usará nomes e identidades autorais; esta matriz registra a lógica esportiva da temporada-modelo 2026.

## Princípio

As copas continentais não escolhem clubes diretamente. Cada associação nacional entrega classificados por uma tabela de rotas: campeão de liga, copa nacional, tabela agregada, melhor não classificado e demais critérios locais. A tabela de rotas é versionada por país e temporada.

As dez associações devem existir no mundo: Argentina, Bolívia, Brasil, Chile, Colômbia, Equador, Paraguai, Peru, Uruguai e Venezuela.

## Copa continental principal — modelo 2026

### Participação e vagas

- 47 clubes de dez associações.
- Brasil: sete vagas-base.
- Argentina: seis vagas-base.
- Demais oito associações: quatro vagas-base cada.
- Os campeões continentais vigentes possuem entradas protegidas; o alocador resolve sobreposição de vaga conforme a regra daquele ano.

### Fases

1. Primeira preliminar: seis clubes, em confrontos eliminatórios.
2. Segunda preliminar: 16 clubes.
3. Terceira preliminar: oito clubes; quatro avançam à fase de grupos e quatro migram para a copa continental secundária.
4. Fase de grupos: 32 clubes, oito grupos de quatro.
5. Oitavas, quartas e semifinais: mata-mata.
6. Final: jogo único.

Nos grupos, os dois primeiros avançam ao mata-mata; os terceiros disputam um playoff contra os vice-líderes da copa secundária.

## Copa continental secundária — modelo 2026

### Participação e vagas

- 44 clubes de dez associações antes da incorporação dos clubes vindos da preliminar da competição principal.
- Brasil: seis vagas-base, entrando diretamente na fase de grupos.
- Argentina: seis vagas-base, entrando diretamente na fase de grupos.
- Demais oito associações: quatro vagas-base cada, começando em fase nacional preliminar.

### Fases

1. Fase nacional: 32 clubes dos oito países fora de Brasil/Argentina, com confrontos entre clubes da mesma associação; 16 vencedores avançam.
2. Fase de grupos: 32 clubes = 12 de Brasil/Argentina + 16 vencedores nacionais + 4 eliminados da terceira preliminar da competição principal.
3. Playoff: cada vice-líder de grupo enfrenta um terceiro colocado da competição principal.
4. Oitavas, quartas e semifinais: mata-mata.
5. Final: jogo único.

Os líderes de grupo avançam diretamente às oitavas; os vice-líderes passam pelo playoff.

## Relações entre as copas

| Evento | Consequência no motor |
|---|---|
| Eliminado na terceira preliminar principal | entra na fase de grupos da secundária |
| Terceiro do grupo principal | enfrenta vice-líder de grupo da secundária no playoff |
| Campeão principal | classifica-se para a Recopa seguinte e representa a CONMEBOL no torneio intercontinental anual |
| Campeão secundário | classifica-se para a Recopa seguinte e pode receber vaga protegida na competição principal seguinte |

## Recopa continental

- Final entre os campeões das duas competições continentais da temporada anterior.
- É uma competição de abertura de calendário continental e deve ter ficha própria de datas, mandos e desempate.

## Mundial de Clubes — conexão correta

O campeão continental sul-americano alimenta a competição intercontinental anual da FIFA. A FIFA informa que esse torneio reúne, anualmente, os campeões das seis confederações. O grande Mundial de Clubes atual é separado e quadrienal; suas vagas exigem módulo próprio de ciclo classificatório.

O produto deve tratar esses dois eventos separadamente:

- **Intercontinental anual:** campeão sul-americano da temporada enfrenta campeões de outros continentes, inclusive os externos ainda simulados.
- **Mundial quadrienal:** módulo posterior, com regras de ciclo e vagas por confederação; não deve ser confundido com o torneio anual.

## Requisitos por país

Para cada uma das dez associações, a implementação precisa de uma ficha de classificação com:

- torneios domésticos que concedem vagas;
- ordem de prioridade entre campeão de liga, copa e tabela agregada;
- regra para vaga duplicada de campeão;
- fase continental de entrada por posição;
- datas de encerramento doméstico e entrega de classificados;
- licenciamento/inelegibilidade, caso a regra de temporada exija.

Brasil é tratado em documento separado: [Matriz Brasil 2026](brasil-matriz-regulamentos-2026.md).

## Fonte e validação

- [Regulamentos de competições CONMEBOL](https://www.conmebol.com/reglamentos-de-competiciones/)
- [Manual de Clubes CONMEBOL Libertadores 2026](https://cdn.conmebol.com/wp-content/uploads/2025/12/Manual-de-Clubes-CONMEBOL-Libertadores-2026-ESP.pdf)
- [Manual de Clubes CONMEBOL Sudamericana 2026](https://cdn.conmebol.com/wp-content/uploads/2025/12/Manual-de-Clubes-CONMEBOL-Sudamericana-2026-ESP.pdf)
- [Informações da FIFA sobre a competição intercontinental anual](https://www.fifa.com/en/tournaments/mens/intercontinentalcup/2024/articles/information-tournament-details)

Antes de codificar, a distribuição de vagas e os desempates de cada ficha nacional devem ser conferidos diretamente contra os manuais oficiais da edição aplicável.
