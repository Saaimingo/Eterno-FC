# Eterno FC — Bíblia do Jogo v1

Documento de produto consolidado a partir das decisões de Adilson Simon e Codex.
Status: direção de produto aprovada; não é ainda especificação de implementação.

## 1. Essência

Simulador de carreira de treinador, leve na apresentação e profundo no mundo. O foco é gerir clube, elenco, tática, mercado e carreira em um universo de futebol persistente.

O jogo é inspirado na cultura e na organização do futebol real, mas usa identidade autoral para clubes, jogadores, competições, notícias e elementos visuais. Uma camada futura de conteúdo oficial poderá substituir identidades e dados sem alterar o motor.

## 2. Mundo persistente

- Cada carreira é um universo independente e começa em 1º de janeiro de 2026.
- O calendário é global e diário; cada país mantém seu próprio ciclo de temporada.
- O mundo não reinicia: atletas envelhecem, aposentam-se e são substituídos por novas gerações.
- Uma carreira pode avançar décadas ou séculos, preservando títulos, recordes, ídolos, transferências e histórico.
- Novas ligas precisam ser adicionadas por módulos, sem quebrar carreiras existentes.

## 3. Mundo inicial

### América do Sul — 10 países CONMEBOL

Brasil, Argentina, Uruguai, Paraguai, Chile, Colômbia, Equador, Peru, Bolívia e Venezuela.

- Brasil: três divisões nacionais (A, B e C), estaduais/regionais, copa nacional e supercopa.
- Argentina: duas divisões iniciais.
- Demais países: ao menos primeira divisão; segunda divisão onde o regulamento e a profundidade inicial justificarem.
- As ligas alimentam duas copas continentais sul-americanas e, por consequência, o Mundial de Clubes.

### Europa — 10 países

Inglaterra, Espanha, Itália, Alemanha, França, Portugal, Holanda, Bélgica, Escócia e Turquia.

- Grandes ligas: primeira e segunda divisões.
- Ligas menores do grupo: primeira divisão inicialmente, com expansão modular posterior.
- Todas alimentam as copas continentais europeias por regras de classificação equivalentes às temporadas-modelo pesquisadas.

### Outros continentes

África e Ásia não entram como ligas jogáveis no primeiro lançamento. Seus representantes para o Mundial existem como clubes externos simulados. Quando esses continentes entrarem, deverão entrar com estruturas completas, não como preenchimento superficial.

## 4. Regulamentos e calendário

Cada competição terá um regulamento versionado por temporada, pesquisado em fontes oficiais:

- clubes, divisões e formato;
- acesso, descenso e critérios de desempate;
- vagas continentais;
- copas, estaduais e regionais;
- janela de transferências;
- elegibilidade, calendário e premiação esportiva/econômica.

O agendador valida conflitos de datas, vagas sem ocupante e classificação entre competições antes de cada temporada.

Nomes, troféus, marcas e apresentação das competições são autorais; a lógica esportiva é documentada a partir dos regulamentos reais.

### Regra-mãe aprovada

Para todos os países e competições, o jogo segue a lógica vigente e documentada do futebol real: calendário, formato, acesso, descenso, classificação e vínculo entre torneios. Não se presume uma regra por memória ou conveniência. A camada autoral substitui apenas nomes, símbolos, troféus e apresentação.

### Brasil — direção aprovada

- Estaduais completos como base cultural e classificatória.
- Três blocos regionais equivalentes: Nordeste, Norte/Centro-Oeste e Sul/Sudeste.
- Clubes em competições continentais ficam fora dos regionais, conforme o modelo brasileiro atual.
- Resultados estaduais e regionais alimentam a copa nacional por regras de vagas/ranking versionadas.
- A rota para competições continentais será mapeada separadamente por temporada, sem presumir que um regional concede vaga continental.

## 5. Carreira de treinador

- A experiência padrão começa com clube sorteado, em qualquer país e divisão jogável.
- Escolher clube é uma alternativa opcional, não o modo principal.
- O treinador começa sem reputação; desempenho, títulos e projetos concluídos constroem currículo.
- O jogador define disponibilidade para propostas: fechado, aberto ou procurando emprego.
- Se fechado, não recebe propostas; se desempregado, entra automaticamente no mercado.
- Clubes e treinadores de IA movimentam o mercado independentemente do usuário.
- Ofertas exibem salário, duração, multa já viabilizada, orçamento e meta principal. O contrato detalhado é consultável, nunca leitura obrigatória.

## 6. Diretoria e economia

- Cada diretoria define até cinco metas com pesos diferentes.
- Não há demissão automática por falhar uma única meta.
- Avaliação considera meta principal, metas secundárias, trajetória, finanças, contexto competitivo e confiança acumulada.
- Subir de divisão recalcula receitas, orçamento de transferências, teto salarial, patrocínio, público e poder de atração.
- Cair reduz receitas e pode gerar proteção financeira temporária quando o regulamento-modelo daquele país indicar.
- Acesso oferece capacidade real de competir, mas não garante permanência.

## 7. Atletas

### Ciclo de vida

- Jovens entram na base entre 15 e 17 anos.
- Evolução depende de idade, potencial, minutos, desempenho, contexto e acontecimentos do mundo.
- Aposentadoria é dinâmica e preserva o histórico do atleta.
- Clubes e países com tradição de base possuem maior probabilidade de revelar talentos, sem monopolizar a geração de craques.
- Podem surgir joias prontas para banco, titularidade ou protagonismo muito cedo.
- O motor mantém distribuição saudável de talento por posição e divisão ao longo das décadas.

### Avaliação

- O motor utiliza atributos técnicos, físicos, mentais, táticos e comportamentais detalhados.
- A interface mostra posição, idade, nacionalidade, desempenho, contrato, valor, seis indicadores amplos e traços de estilo.
- Força é contextual à posição e função; não há soma universal burra de atributos.
- Um atacante pode ter força geral moderada, mas ser decisivo por finalização, posicionamento e frieza excepcionais.
- Potencial é estimado, não uma garantia de carreira.

### Gestão simplificada

- Não haverá telas pesadas de treino diário, fisioterapia ou comissão técnica.
- Evolução, condição e lesões são administradas pelo motor.
- O treinador recebe apenas o estado útil: condição física, lesão, retorno previsto e desempenho.

## 8. Partidas e tática

- Partidas são simuladas por eventos derivados de atributos, tática, formação, entrosamento, fadiga, moral, mando de campo e aleatoriedade limitada.
- Campo 2D leve e legível acompanha a narração: posse, setor, direção, jogador envolvido e desfecho de cada lance.
- O treinador pode pausar, substituir atletas, mudar formação, mentalidade e instruções.
- Controles táticos: formação, mentalidade, estilo, ritmo, linha defensiva e funções individuais.
- Profundidade para quem quer pensar futebol, sem painel burocrático para quem quer jogar.

## 9. Mercado e olheiros

- Mercado respeita janelas locais e regras específicas; atletas livres seguem regra própria.
- Compra, venda, empréstimo, pré-contrato, cláusulas e propostas concorrentes são resolvidos pelo motor de negociação.
- Clube vendedor, atleta, empresário, projeto esportivo, salário, divisão, reputação e concorrência influenciam decisões.
- Estatísticas básicas são públicas.
- Olheiros ampliam a precisão de atributos, potencial, lesões, personalidade, salário provável e interesse do atleta.
- Busca por posição, idade, preço, país, estilo e desempenho deve ser rápida e objetiva.

## 10. Notícias, prêmios e memória

- Notícias são geradas pelo próprio universo, não copiadas de veículos externos.
- Prioridade para clube e liga do usuário, com visão nacional, continental e mundial filtrável.
- Manchetes servem como descoberta: artilheiro barato de divisão inferior, jovem em ascensão, hat-trick, crise de clube, transferência e demissão.
- Toda notícia relevante permite abrir ficha de atleta, clube ou competição.
- Prêmios e nomes são autorais; a memória do mundo guarda campeões, recordes, ídolos e grandes transferências.

## 11. Saves e monetização

### Gratuito

- Até dois mundos ativos, com salvamento ilimitado em cada mundo.
- Uma liga nacional escolhida por carreira.
- Campeonato nacional, elenco, partidas, tabela e mercado básico funcionais.
- Notícias locais e dados essenciais.
- Recursos profundos bloqueados: estaduais, copas continentais, Mundial, base, mercado avançado, histórico e notícias globais.

### Completo — pagamento único

- Muitos mundos ativos.
- Todas as ligas e competições disponíveis.
- Estaduais, copas nacionais/continentais e Mundial.
- Base, mercado avançado, olheiros completos, notícias globais e histórico profundo.
- Sem anúncios forçados e sem assinatura obrigatória.

O desbloqueio no meio de uma carreira deve entrar em vigor de maneira limpa, no próximo ponto de calendário compatível.

## 12. Interface

Interface responsiva para desktop e celular, organizada em cinco áreas:

1. Início — próximo jogo, caixa de entrada, metas e resumo.
2. Elenco — escalação, banco, contratos e estatísticas.
3. Calendário — partidas, competições e avanço do tempo.
4. Mercado — jogadores, propostas, olheiros e treinadores.
5. Mundo — notícias, tabelas, artilharia, copas e histórico.

Partida ocorre em tela dedicada, com narração, campinho 2D e comandos rápidos.

## 13. Próxima fase: pré-produção

1. Criar matriz exata de países, divisões, clubes e competições iniciais. A primeira matriz concluída em nível de arquitetura é [Brasil 2026](brasil-matriz-regulamentos-2026.md).
2. Pesquisar regulamentos oficiais e montar fichas versionadas por temporada. A camada continental sul-americana está estruturada em [CONMEBOL 2026](conmebol-matriz-regulamentos-2026.md); os blocos domésticos estão em [Argentina, Chile e Colômbia](america-do-sul-bloco-1-matriz-inicial.md), [Uruguai, Paraguai e Equador](america-do-sul-bloco-2-matriz-inicial.md) e [Peru, Bolívia e Venezuela](america-do-sul-bloco-3-matriz-inicial.md). A camada europeia está estruturada em [UEFA 2026/27](uefa-matriz-regulamentos-2026-27.md); as fichas domésticas iniciais estão em [Cinco Grandes Ligas](europa-cinco-ligas-matriz-inicial.md) e [Segundo Grupo Europeu](europa-segundo-grupo-matriz-inicial.md).
3. Definir entidades e relações do motor de calendário, mundo, atleta, clube e mercado.
   A proposta inicial está em [Arquitetura Técnica v1](arquitetura-tecnica-proposta-v1.md).
4. Elaborar matriz de recursos gratuito versus completo, incluindo comportamento de upgrade de save.
5. Redesenhar fluxos de interface antes de reescrever funcionalidades.
6. Avaliar/refatorar a base técnica existente contra esta arquitetura antes de implementar módulos.
