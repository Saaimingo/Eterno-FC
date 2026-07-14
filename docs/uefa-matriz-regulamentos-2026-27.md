# Eterno FC — Matriz UEFA 2026/27

Base de pré-produção para a camada continental europeia. O produto usará identidades autorais; esta matriz documenta a lógica esportiva oficial da temporada 2026/27.

## Princípio

Cada vaga europeia nasce numa rota doméstica: posição na liga, campeão de copa, campeão continental anterior ou ajuste de vaga. A UEFA define a lista de acesso por coeficiente de associação e coeficiente de clubes; portanto, a vaga não pode ser codificada como uma regra imutável de cada país.

O save que começa em janeiro de 2026 recebe as competições 2025/26 como estado-semente. A temporada 2026/27 será a primeira geração integral do universo para as competições europeias.

## Associações modeladas integralmente

Inglaterra, Espanha, Itália, Alemanha, França, Portugal, Holanda, Bélgica, Escócia e Turquia.

Cada uma terá ficha doméstica própria para primeira/segunda divisão inicial, copa nacional, classificação continental, acesso, descenso e calendário.

As demais associações UEFA não jogáveis precisam existir como provedores externos de classificados. Elas geram campeões, posições continentais, coeficientes e clubes participantes das preliminares, sem exigirem uma pirâmide doméstica jogável no lançamento.

## Lista de acesso e coeficientes

- A lista de acesso é versionada a cada temporada.
- Ela usa o ranking de associações e determina quantas vagas/qualifying rounds cada país recebe.
- Campeões continentais, vagas que se sobrepõem e desistências geram realocação conforme o regulamento.
- As duas associações com melhor desempenho coletivo europeu na temporada anterior recebem uma vaga adicional de desempenho europeu, atribuída à melhor posição doméstica ainda não classificada à competição principal.

O motor precisa de um **alocador de vagas**, não de simples “top 4 vai para torneio X”.

## Competição europeia principal — modelo 2026/27

- 36 clubes na fase de liga única.
- Cada clube joga oito partidas contra adversários diferentes, quatro em casa e quatro fora.
- Os oito primeiros avançam diretamente às oitavas.
- As posições 9 a 24 jogam um playoff eliminatório; os oito vencedores completam as oitavas.
- As posições 25 a 36 são eliminadas.
- Oitavas, quartas e semifinais são mata-mata; final em jogo único.

## Competição europeia secundária — modelo 2026/27

- 36 clubes na fase de liga única, com oito partidas por clube.
- Mesma regra de classificação: 1–8 direto às oitavas; 9–24 no playoff; 25–36 eliminados.
- A composição da fase de liga inclui classificados diretos, vencedores de qualificatórias e perdedores de fases específicas da competição principal.
- Campeão recebe rota protegida para a competição principal seguinte, conforme a lista de acesso da edição seguinte.

## Competição europeia terciária — modelo 2026/27

- 36 clubes na fase de liga única.
- Cada clube joga seis partidas, três em casa e três fora.
- Mesma faixa classificatória: 1–8 direto às oitavas; 9–24 no playoff; 25–36 eliminados.
- Todos os 36 clubes chegam à fase de liga via qualificatórias; não há entrada direta.

## Migração entre competições

- Perdedores de rodadas específicas da qualificatória principal podem migrar para a secundária ou terciária, conforme a lista de acesso.
- Depois da fase de liga, clubes eliminados não são transferidos para outra competição europeia.
- Os terceiros colocados da antiga fase de grupos não existem mais; o motor não deve reproduzir esse mecanismo antigo.

## Supercopa europeia e conexão mundial

- A supercopa continental ocorre entre os campeões da competição principal e da secundária da temporada anterior.
- O campeão da competição principal representa a Europa no torneio intercontinental anual da FIFA.
- O Mundial de Clubes quadrienal é uma camada distinta, com ciclo de vagas próprio.

## Fichas nacionais ainda necessárias

Para cada uma das dez ligas modeladas, pesquisar e registrar:

1. quantidade de clubes e calendário;
2. formato de liga, acesso, descenso e desempates;
3. copa nacional e eventuais copas secundárias;
4. quais posições domésticas entregam vagas europeias;
5. prioridade e redistribuição quando campeão de copa já se classificou pela liga;
6. janela de transferências e datas de entrega de classificados.

## Fontes oficiais

- [Lista de acesso UEFA 2026/27](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27/Annex-A-Access-List-for-the-2026/27-UEFA-Club-Competitions-Online)
- [Regulamento da competição principal 2026/27](https://documents.uefa.com/r/Regulations-of-the-UEFA-Champions-League-2026/27-Online)
- [Regulamento da competição secundária 2026/27](https://documents.uefa.com/r/Regulations-of-the-UEFA-Europa-League-2026/27-Online)
- [Regulamento da competição terciária 2026/27](https://documents.uefa.com/r/Regulations-of-the-UEFA-Conference-League-2026/27-Online)
- [Explicação oficial do formato da competição principal](https://www.uefa.com/uefachampionsleague/competition-format/)
