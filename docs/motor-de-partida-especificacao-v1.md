# Eterno FC — Especificação Mestra do Motor de Partida

**Versão:** 1.0 — consolidação conceitual inicial  
**Data:** 14 de julho de 2026  
**Estado:** base canônica para projeto, prototipação e calibração  
**Escopo:** jogadores, atributos, decisões, tática, simulação, apresentação, evolução e validação

---

## 1. Propósito

O motor de partida é o núcleo da jogabilidade do Eterno FC. Ele deverá transformar jogadores, atributos, funções, táticas, contexto e decisões do treinador em uma partida coerente, surpreendente, auditável e visualmente compreensível.

O objetivo não é reproduzir física 3D. O objetivo é produzir **causalidade futebolística**: o usuário deve perceber que uma jogada ocorreu por causa dos atletas envolvidos, da disposição tática, do momento da partida e da oposição — sem que o resultado pareça previamente escolhido ou arbitrariamente sorteado.

### 1.1 Tese central

> **Capacidade não é escolha. Escolha não é execução. Execução não garante resultado.**

Em termos de jogo:

> **Atributo indica o que o jogador pode fazer. Traço indica o que prefere fazer. Função e tática indicam o que deveria fazer. Estado e contexto indicam o que consegue fazer naquele momento. A oposição e a variância controlada determinam o resultado do confronto.**

### 1.2 Promessa ao jogador

- nenhum vencedor será escolhido antecipadamente;
- a nota geral não decidirá lances;
- jogadores especialistas poderão ser valiosos mesmo com nota geral inferior;
- equipes fortes terão vantagens acumuladas, nunca vitória garantida;
- todos os clubes obedecerão às mesmas regras;
- mudanças táticas e substituições afetarão somente o futuro, nunca reescreverão o passado;
- recursos pagos de apresentação não alterarão probabilidades ou resultados.

---

## 2. Decisões canônicas

As seguintes decisões ficam estabelecidas como direção do projeto:

1. **Simulação orientada a eventos e posses**, e não placar-first.
2. **Motor independente da apresentação**: texto, campinho 2D, narração e estatísticas representam o mesmo registro oficial de eventos.
3. **Nota geral é derivada e informativa**; nunca entra diretamente na resolução de uma ação.
4. **Atributos universais são usados conforme o contexto**. Cabeceio serve para um zagueiro defender e atacar bolas aéreas; não o transforma automaticamente em atacante.
5. **Posição é familiaridade espacial e comportamental**, não uma caixa rígida de habilidades.
6. **Função é uma expectativa tática**, como zagueiro construtor, volante marcador ou atacante móvel.
7. **Traços são tendências**, como tentar passes longos ou chegar de trás à área; não são garantias de sucesso.
8. **Pé dominante e pé fraco têm proficiências próprias**, não valores binários.
9. **Fadiga e condição modificam a capacidade entregue**, sem mudar permanentemente a identidade do atleta.
10. **Variância existe, mas é limitada pelo contexto**. Aleatoriedade não substitui atributos e tática.
11. **O futuro ainda não confirmado pode mudar** após intervenção do treinador.
12. **A simulação deve ser reprodutível por semente** para testes, auditoria e replay.
13. **O mundo continuará após aposentadorias**, com base, novos jogadores, desenvolvimento, declínio e memória histórica.
14. **Craques raros emergem de combinações raras**, desenvolvimento, contexto e carreira; não de um rótulo secreto que garante sucesso.

### 2.1 O que o motor não deverá fazer

- escolher o placar final e inventar acontecimentos para justificá-lo;
- usar a nota geral como bônus universal;
- incluir todos os atributos em todas as ações;
- conceder força oculta para equilibrar artificialmente a partida;
- criar “roteiro de virada” ou favorecimento do usuário;
- mudar o resultado porque o usuário paga uma assinatura;
- usar IA generativa como autoridade sobre eventos;
- exigir modelos 3D, física corporal ou renderização pesada;
- esconder erros de calibração atrás de uma narração convincente.

---

## 3. Modelo mental do motor

Cada ação deverá atravessar sete etapas:

1. **Percepção:** quais oportunidades o jogador consegue enxergar?
2. **Geração de opções:** passe, condução, cruzamento, chute, recuo, disputa ou movimento.
3. **Escolha:** qual opção ele prefere diante de tática, traços, risco e contexto?
4. **Execução:** ele consegue realizar tecnicamente a ação escolhida?
5. **Contestação:** companheiros e adversários reagem.
6. **Resultado:** sucesso, falha, desvio, disputa, falta, defesa, gol ou continuidade.
7. **Transição:** estado da partida e registro de eventos são atualizados.

```text
Perceber → Escolher → Executar → Contestar → Resolver → Registrar → Apresentar
```

### 3.1 Regra fundamental de separação

Um jogador pode:

- enxergar um passe e decidir não tentá-lo;
- decidir pelo passe correto e errar a execução;
- executar um passe excelente e sofrer uma interceptação ainda melhor;
- tomar uma decisão arriscada, executar mal e mesmo assim ser beneficiado por um desvio;
- finalizar corretamente e encontrar uma defesa excepcional.

Essa separação impede que um único atributo explique sozinho o futebol.

---

## 4. Arquitetura lógica

### 4.1 Componentes

| Componente | Responsabilidade |
|---|---|
| `PlayerModel` | identidade, corpo, pés, atributos, posições, traços e desenvolvimento |
| `TeamSnapshot` | escalação e estado dos atletas no início da partida |
| `TacticalPlan` | formação, funções, mentalidade e instruções |
| `MatchContext` | competição, mando, estádio, clima opcional, importância e arbitragem |
| `MatchState` | tempo, placar, posse, posições, fadiga, cartões e substituições |
| `PerceptionEngine` | oportunidades percebidas por cada jogador |
| `DecisionEngine` | escolha contextual de ações |
| `ActionResolver` | execução e confronto entre jogadores |
| `RuleEngine` | faltas, cartões, impedimento, bola parada e acréscimos |
| `EventLedger` | verdade canônica e imutável dos acontecimentos confirmados |
| `StatisticsProjector` | posse, passes, finalizações, xG, mapas e avaliações |
| `PresentationAdapter` | tradução de eventos para o campo 2D e a linha do tempo |
| `NarrationAdapter` | texto e voz baseados exclusivamente em eventos confirmados |
| `CalibrationHarness` | simulações em massa, métricas, regressões e equilíbrio |

### 4.2 Fonte da verdade

O `EventLedger` será a fonte oficial da partida. Nenhuma camada visual poderá alterar o jogo.

```text
Motor → Evento confirmado → Estatísticas
                         ↘ Campo 2D
                         ↘ Narração textual
                         ↘ Voz e efeitos
                         ↘ Placares da rodada
                         ↘ Tabela provisória
```

---

## 5. Modelo canônico do jogador

### 5.1 Identidade e biografia

- ID permanente;
- nome e nome curto;
- data de nascimento;
- nacionalidade e elegibilidade;
- clube e categoria;
- altura e massa corporal;
- posição principal;
- posições secundárias;
- histórico de clubes, temporadas, partidas, gols, assistências e títulos;
- origem na base e linhagem de desenvolvimento;
- estado de carreira: base, profissional, declínio, aposentado.

### 5.2 Pés

Cada pé terá proficiência independente, preferencialmente em escala interna contínua:

```text
pé_direito: 0..1000
pé_esquerdo: 0..1000
```

O sistema de apresentação poderá converter para 1–20, 1–100 ou descrições como “fraco”, “razoável” e “ambidestro”.

O pé utilizado deverá depender de:

- posição corporal;
- direção do movimento;
- tempo disponível;
- pressão;
- tipo de ação;
- traço de evitar o pé fraco;
- técnica e equilíbrio.

Usar o pé fraco reduz a qualidade provável, mas nunca torna a ação impossível.

### 5.3 Corpo e alcance

- altura;
- massa;
- alcance aéreo derivado;
- centro de gravidade derivado;
- velocidade máxima;
- aceleração;
- força;
- agilidade;
- equilíbrio;
- resistência;
- condição física natural.

Altura não será sinônimo de cabeceio. Um atleta alto pode alcançar a bola e cabecear mal; um atleta menor pode possuir excelente técnica de cabeceio, mas perder disputas contra adversários de maior alcance.

### 5.4 Atributos técnicos de linha

| Atributo | Significado operacional |
|---|---|
| Escanteios | qualidade de cobranças de canto |
| Cruzamento | precisão e utilidade da bola colocada na área |
| Drible | controle ao superar adversários com a bola |
| Finalização | precisão e colocação em chutes próximos ao gol |
| Primeiro toque | qualidade do domínio e preparação da próxima ação |
| Falta | execução de cobranças diretas e indiretas |
| Cabeceio | qualidade técnica do contato de cabeça |
| Chute de longe | qualidade de finalizações distantes |
| Arremesso lateral | distância e precisão de laterais |
| Marcação | capacidade de acompanhar e limitar um adversário |
| Passe | consistência e precisão da entrega da bola |
| Pênalti | execução específica da penalidade |
| Desarme | capacidade de recuperar a bola em disputa direta |
| Técnica | repertório e qualidade mecânica de ações difíceis |

### 5.5 Atributos mentais

| Atributo | Significado operacional |
|---|---|
| Agressividade | frequência e intensidade de envolvimento em disputas |
| Antecipação | previsão e velocidade de reação ao desenvolvimento do lance |
| Bravura | disposição para entrar em confrontos de risco |
| Compostura | estabilidade sob pressão e em oportunidades decisivas |
| Concentração | manutenção da qualidade mental evento após evento |
| Decisões | qualidade provável da escolha entre opções percebidas |
| Determinação | persistência diante de adversidade e esforço para competir |
| Improvisação | propensão a soluções criativas e inesperadas |
| Liderança | influência emocional e organizacional sobre companheiros |
| Movimento sem bola | qualidade do deslocamento ofensivo para oferecer opção ou atacar espaço |
| Posicionamento defensivo | leitura e ocupação de espaços sem posse |
| Trabalho em equipe | adesão a instruções e suporte aos companheiros |
| Visão | capacidade de perceber oportunidades em desenvolvimento |
| Intensidade de trabalho | disposição para executar o esforço solicitado |

### 5.6 Atributos físicos

| Atributo | Significado operacional |
|---|---|
| Aceleração | tempo necessário para alcançar velocidade elevada |
| Agilidade | capacidade de iniciar, parar e mudar de direção |
| Equilíbrio | estabilidade corporal com e sem bola |
| Alcance no salto | altura efetiva alcançada em disputas aéreas |
| Condição natural | recuperação, retenção física e resistência ao declínio |
| Velocidade | velocidade máxima atingível |
| Resistência | duração de atividade intensa antes de perda relevante de execução |
| Força | capacidade de aplicar e suportar contato físico |

### 5.7 Atributos de goleiro

| Atributo | Significado operacional |
|---|---|
| Alcance aéreo | capacidade física de alcançar bolas altas |
| Comando da área | tendência e qualidade decisória ao assumir bolas na área |
| Comunicação | organização da linha defensiva |
| Excentricidade | tendência a ações não convencionais |
| Segurança das mãos | retenção da bola e redução de rebotes |
| Reposição com os pés | distância e precisão de chutes e tiros de meta |
| Um contra um | decisão e execução diante de atacante isolado |
| Reflexos | reação a acontecimentos rápidos e imprevisíveis |
| Saída do gol | frequência e tempo de avanço sobre bolas profundas |
| Socar a bola | preferência e execução ao afastar em vez de segurar |
| Reposição com as mãos | alcance e precisão para iniciar transições |

Goleiros também poderão usar Passe, Primeiro Toque, Técnica, Compostura, Decisões, Aceleração e Velocidade.

### 5.8 Tendências e traços

Traços alteram **frequência de escolha**, não qualidade automática de execução.

Exemplos:

- dita o ritmo;
- conduz a bola para o meio;
- tenta passes decisivos;
- prefere passes simples;
- tenta lançamentos longos;
- troca o lado da jogada;
- cruza cedo;
- chega de trás à área;
- permanece na defesa;
- corta para dentro;
- mantém amplitude;
- corre com a bola frequentemente;
- evita condução;
- finaliza de primeira;
- coloca a bola;
- chuta com força;
- tenta encobrir o goleiro;
- contorna o goleiro;
- evita o pé fraco;
- pressiona e entra em disputas;
- evita desarmes arriscados;
- sai jogando sob pressão;
- joga de costas para o gol;
- busca tabelas;
- provoca adversários;
- levanta a torcida.

### 5.9 Perfil de personalidade e desenvolvimento

Esses fatores poderão permanecer total ou parcialmente ocultos e ser inferidos por olheiros, treinadores e comportamento:

- profissionalismo;
- ambição;
- adaptabilidade;
- versatilidade;
- estabilidade emocional;
- resposta à pressão;
- disciplina;
- propensão a lesões;
- consistência;
- desempenho em jogos importantes;
- lealdade e intenção de carreira;
- capacidade de aprendizado;
- potencial e incerteza do potencial.

Eles não devem produzir destinos rígidos. Devem alterar distribuições de desenvolvimento, escolha e desempenho.

### 5.10 Estado dinâmico de partida

Estado momentâneo não é atributo permanente:

- energia;
- fadiga aguda;
- condição e ritmo de jogo;
- desconforto ou lesão;
- confiança;
- moral;
- foco;
- ansiedade/pressão;
- cartão recebido;
- risco disciplinar;
- adaptação à função e ao plano tático;
- participação recente e carga acumulada.

“Forma” deverá ser majoritariamente uma descrição de resultados recentes, e não um bônus mágico. Efeitos reais deverão vir de confiança, condição, idade, lesões, encaixe, companheiros, adversários e tática.

---

## 6. Posição, função e nota derivada

### 6.1 Familiaridade posicional

Cada jogador terá uma matriz de familiaridade por zona, lado e altura do campo:

```text
goleiro
zagueiro_esquerdo / zagueiro_central / zagueiro_direito
lateral_esquerdo / lateral_direito
volante
meia_central_esquerdo / central / direito
meia_ofensivo
ponta_esquerda / ponta_direita
segundo_atacante
centroavante
```

Familiaridade altera principalmente:

- posicionamento;
- percepção de opções típicas;
- tempo de decisão;
- consistência de execução de deveres;
- coordenação com companheiros;
- adesão à estrutura tática.

Ela não apaga atributos. Um zagueiro de cabeceio excelente continua perigoso no alto mesmo improvisado como atacante, embora se movimente e decida pior na função ofensiva.

### 6.2 Funções

Exemplos de funções:

- zagueiro de contenção;
- zagueiro construtor;
- líbero;
- lateral defensivo;
- lateral de apoio;
- ala ofensivo;
- volante marcador;
- volante construtor;
- meia área a área;
- organizador recuado;
- armador;
- meia infiltrador;
- ponta aberto;
- atacante interior;
- segundo atacante;
- atacante móvel;
- pivô;
- finalizador de área.

Cada função deverá declarar:

- zonas preferenciais;
- ações mais e menos prováveis;
- grau de risco;
- atributos primários;
- atributos secundários;
- dependências de companheiros;
- fraquezas táticas previsíveis.

### 6.3 Nota geral e nota por função

O sistema poderá mostrar uma nota geral, mas ela será derivada para facilitar leitura e scouting.

```text
nota_como_zagueiro_construtor = pesos dos atributos relevantes + familiaridade
nota_como_volante = outros pesos + familiaridade
```

Regras:

- a nota não entra em `ActionResolver`;
- o mesmo atleta terá avaliações diferentes por função;
- especialistas podem superar jogadores de nota geral maior em contextos específicos;
- a avaliação poderá aparecer como faixa quando o atleta não estiver plenamente observado;
- potencial também poderá aparecer como faixa e conter erro de scouting.

---

## 7. Plano tático

### 7.1 Estrutura

- formação sem posse;
- estrutura com posse;
- mentalidade;
- ritmo;
- largura;
- altura da linha defensiva;
- linha de pressão;
- intensidade de pressão;
- tipo e risco de passe;
- construção curta, direta ou mista;
- foco pelo centro ou lados;
- transição após recuperar;
- reação após perder;
- uso de sobreposição;
- liberdade criativa;
- desperdício de tempo;
- plano de bolas paradas.

### 7.2 Relação entre ordem e personalidade

O treinador define preferências coletivas, mas cada jogador interpreta a ordem conforme:

- Trabalho em Equipe;
- Decisões;
- familiaridade tática;
- função;
- traços;
- compostura;
- contexto.

Um atleta muito individualista pode ignorar uma opção segura. Um jogador limitado pode obedecer corretamente e falhar na execução. Um craque pode romper a instrução e criar algo extraordinário — ou perder a bola.

### 7.3 Intervenções

- substituição;
- mudança de posição;
- mudança de função;
- ajuste de mentalidade;
- ajuste de pressão;
- troca de ritmo e largura;
- instrução individual;
- alteração de bola parada;
- pausa e retorno.

Intervenções não garantem benefício. Elas alteram as opções futuras e podem gerar efeitos colaterais.

---

## 8. Ciclo da partida

### 8.1 Preparação

1. congelar escalações e disponibilidade;
2. criar `TeamSnapshot` dos dois clubes;
3. carregar planos táticos;
4. calcular contexto e mando;
5. gerar semente auditável;
6. iniciar estados físicos e emocionais;
7. montar relações de marcação e zonas;
8. iniciar em 0–0 sem vencedor definido.

### 8.2 Unidade de simulação

O motor não precisa simular cada milissegundo físico. A unidade recomendada é uma combinação de:

- janela curta de tempo;
- fase da posse;
- evento significativo;
- posições aproximadas dos envolvidos.

### 8.3 Fases de posse

```text
reinício
→ saída
→ construção
→ progressão
→ criação
→ entrada em zona perigosa
→ finalização ou perda
→ transição
```

Uma posse pode pular fases em contra-ataques ou bolas longas.

### 8.4 Compromisso de eventos

- eventos passados são imutáveis;
- o motor pode calcular alguns segundos à frente;
- somente eventos comprometidos entram no `EventLedger`;
- intervenção invalida apenas o futuro ainda não comprometido;
- modos passivos podem simular a partida inteira antes da reprodução;
- modos interativos devem trabalhar por janelas curtas.

### 8.5 Velocidade de reprodução

- Instantâneo: resultado e momentos-chave;
- Ultrarrápido: eventos essenciais;
- Rápido: jogadas relevantes condensadas;
- Normal: fluxo completo resumido;
- Imersivo: mais desenvolvimento, pausas e oportunidade de intervenção.

Sem intervenção, a velocidade altera apenas apresentação. Não deverá gerar um novo resultado.

---

## 9. Pipeline de decisão

### 9.1 Percepção

O jogador recebe um conjunto limitado de informações, conforme:

- Visão;
- Antecipação;
- Concentração;
- posição corporal;
- campo de visão;
- distância;
- pressão;
- fadiga;
- familiaridade;
- estrutura tática.

Ele não deve ter acesso onisciente ao campo.

### 9.2 Geração de opções

Exemplos:

- passe curto;
- passe de segurança;
- inversão;
- lançamento;
- passe em profundidade;
- condução;
- drible;
- cruzamento;
- chute;
- proteção da bola;
- recuo;
- afastamento;
- desaceleração;
- movimento sem bola.

### 9.3 Pontuação de utilidade

Cada opção recebe utilidade contextual, nunca uma regra absoluta:

```text
utilidade = ganho_tático
          + adequação_ao_papel
          + preferência_do_jogador
          + probabilidade_percebida
          - risco_percebido
          - custo_físico
```

`Decisões`, `Compostura`, `Trabalho em Equipe`, mentalidade e traços ajustam essa avaliação.

### 9.4 Escolha não determinística

O jogador não deverá escolher sempre a maior utilidade. Uma distribuição ponderada preserva variedade e erro humano. Quanto melhores Decisões e Compostura, maior a tendência de escolher opções adequadas.

### 9.5 Execução

Estrutura conceitual:

```text
execução = técnica_específica
          + técnica_geral
          + pé_utilizado
          + equilíbrio
          + compostura
          - pressão
          - fadiga
          - dificuldade_geométrica
```

### 9.6 Contestação

```text
resultado = execução_do_ator
          + suporte_dos_companheiros
          - reação_dos_adversários
          + contexto
          + variância_limitada
```

As fórmulas finais deverão usar curvas normalizadas, limites e probabilidades calibradas; os pesos não serão definidos por intuição sem testes.

---

## 10. Matriz de ações

### 10.1 Recepção e primeiro toque

Ator:

- Primeiro Toque;
- Técnica;
- Compostura;
- Equilíbrio;
- pé utilizado;
- Antecipação.

Contexto:

- qualidade e velocidade do passe;
- pressão;
- superfície opcional;
- direção corporal;
- fadiga.

Resultados: domínio orientado, domínio neutro, bola longa, disputa ou perda.

### 10.2 Passe curto

Percepção e escolha:

- Visão;
- Decisões;
- Trabalho em Equipe;
- plano tático;
- traços.

Execução:

- Passe;
- Técnica;
- Compostura;
- Primeiro Toque;
- pé utilizado.

Oposição:

- Antecipação;
- Posicionamento;
- Marcação;
- pressão e fechamento de linha.

### 10.3 Passe em profundidade

Passador:

- Visão;
- Decisões;
- Passe;
- Técnica;
- Improvisação;
- Compostura.

Receptor:

- Movimento sem Bola;
- Antecipação;
- Aceleração;
- Velocidade;
- familiaridade.

Defesa:

- Posicionamento;
- Antecipação;
- Concentração;
- Aceleração;
- comunicação e linha defensiva.

Goleiro:

- Saída do Gol;
- Decisões;
- Aceleração;
- Um Contra Um.

### 10.4 Cruzamento

Cruzador:

- Cruzamento;
- Técnica;
- Equilíbrio;
- pé utilizado;
- Compostura;
- pressão recebida.

Alvo:

- Movimento sem Bola;
- Antecipação;
- Alcance no Salto;
- Cabeceio;
- Força;
- Bravura.

Defensor:

- Marcação;
- Posicionamento;
- Antecipação;
- Alcance no Salto;
- Cabeceio;
- Força;
- Bravura.

Goleiro:

- Comando da Área;
- Alcance Aéreo;
- Segurança das Mãos;
- Socar;
- Comunicação.

### 10.5 Drible

Atacante:

- Drible;
- Técnica;
- Aceleração;
- Agilidade;
- Equilíbrio;
- Improvisação;
- pé utilizado;
- Decisões.

Marcador:

- Desarme;
- Posicionamento;
- Antecipação;
- Agilidade;
- Aceleração;
- Força;
- Decisões;
- cobertura dos companheiros.

### 10.6 Desarme e interceptação

Desarme:

- Desarme;
- Decisões;
- Antecipação;
- Posicionamento;
- Agilidade;
- Força;
- Agressividade;
- Bravura.

Risco de falta:

- pressão temporal;
- ângulo;
- agressividade;
- decisões;
- disciplina;
- traços;
- qualidade do drible adversário.

Interceptação:

- Antecipação;
- Posicionamento;
- Concentração;
- Aceleração;
- leitura da trajetória.

### 10.7 Disputa aérea

Para ambos:

- Alcance no Salto;
- altura;
- Cabeceio;
- Força;
- Bravura;
- Antecipação;
- posição inicial;
- corrida de aproximação;
- fadiga.

Cabeceio técnico e alcance aéreo são separados. Ganhar a altura não garante direcionar corretamente.

### 10.8 Finalização

Escolha de finalizar:

- Decisões;
- Compostura;
- Improvisação;
- Visão de alternativas;
- traços;
- instrução tática;
- qualidade percebida da chance.

Execução próxima:

- Finalização;
- Técnica;
- Compostura;
- Equilíbrio;
- pé utilizado;
- pressão;
- fadiga;
- ângulo e distância.

Execução distante:

- Chute de Longe;
- Técnica;
- Compostura;
- Equilíbrio;
- potência derivada;
- bloqueios.

Defesa:

- Posicionamento e Antecipação dos defensores;
- bloqueios;
- posicionamento, reflexos, alcance, segurança e um contra um do goleiro.

### 10.9 Ação do goleiro

O goleiro decide entre:

- permanecer;
- avançar;
- fechar ângulo;
- segurar;
- espalmar;
- socar;
- interceptar cruzamento;
- repor curto;
- repor longo.

Comando da Área ou Saída do Gol influenciam a tentativa; não garantem sucesso.

### 10.10 Pressão e movimentação sem bola

Pressão:

- Intensidade de Trabalho;
- Trabalho em Equipe;
- Aceleração;
- Resistência;
- Agressividade;
- Decisões;
- estrutura tática.

Movimento ofensivo:

- Movimento sem Bola;
- Antecipação;
- Decisões;
- Aceleração;
- função;
- espaço disponível.

Movimento defensivo:

- Posicionamento;
- Antecipação;
- Concentração;
- Trabalho em Equipe;
- comunicação.

### 10.11 Bola parada

- qualidade do cobrador;
- tipo de cobrança;
- pé e curva;
- rotas ensaiadas;
- marcação individual ou zona;
- bloqueios e movimentos;
- disputa aérea;
- segunda bola;
- chance de contra-ataque.

Zagueiros bons de cabeça poderão ser grandes armas ofensivas sem receber atributos de atacante.

### 10.12 Faltas, cartões e arbitragem

- tipo e intensidade da disputa;
- agressividade;
- decisões;
- disciplina;
- ângulo e atraso;
- contexto de último homem;
- reincidência;
- perfil do árbitro;
- vantagem.

Cartões não devem ser mero sorteio independente do lance.

---

## 11. Fadiga, pressão, fase e desempenho

### 11.1 Fadiga

Fadiga deverá afetar gradualmente:

- frequência de movimentos;
- aceleração recuperável;
- qualidade de execução;
- tempo de reação;
- concentração;
- risco de lesão;
- disposição para pressionar.

Atletas com alta Resistência sustentam intensidade por mais tempo. Condição Natural afeta recuperação entre jogos e manutenção ao longo da carreira.

### 11.2 Pressão de jogo

O contexto 0–0 aos 88 minutos não concede gol, mas altera:

- risco aceito pelas equipes;
- espaço concedido;
- ansiedade;
- valor da Compostura;
- decisões de substituição;
- esforço e fadiga;
- comportamento da torcida.

### 11.3 Fases de carreira

Um artilheiro pode cair de produção por causas observáveis:

- declínio físico;
- lesão;
- perda de confiança;
- mudança de função;
- saída do meia ou lateral que o abastecia;
- adversários mais fortes;
- calendário e fadiga;
- alteração tática;
- menor volume ou qualidade de chances.

Não deverá existir um interruptor oculto “temporada ruim”. A fase deve emergir de fatores e acontecimentos.

---

## 12. Formação de craques, especialistas e peças raras

### 12.1 Craque geracional

Um craque geracional não é apenas nota alta. É uma combinação rara de:

- vários atributos de elite que se reforçam;
- poucos pontos fracos limitantes;
- traços compatíveis;
- decisões e compostura elevadas;
- capacidade física adequada ao estilo;
- ambidestria ou domínio extraordinário do pé principal;
- potencial, profissionalismo e desenvolvimento;
- contexto que permita expressão.

### 12.2 Especialista

Um jogador geral mediano poderá ser extraordinário numa arma:

- lateral veloz, resistente e cruzador;
- volante marcador com chute de longe;
- zagueiro dominante pelo alto;
- meia de bola parada;
- atacante de movimentação e finalização, mas pouca construção;
- ponta ambidestro;
- goleiro excelente em um contra um, limitado na saída.

### 12.3 Raridade emergente

Raridade deverá vir de distribuições, correlações e desenvolvimento — não de uma lista fixa de “lendários”.

- combinações comuns devem ser frequentes;
- combinações completas devem ser exponencialmente raras;
- atributos podem possuir correlações realistas sem criar clones;
- país, região, academia e filosofia podem influenciar levemente perfis;
- nenhuma origem garante um craque;
- talentos raros podem nascer em clubes pequenos.

---

## 13. Desenvolvimento, base e aposentadoria

### 13.1 Potencial

Potencial será teto probabilístico, não destino garantido. O crescimento dependerá de:

- idade;
- minutos adequados;
- nível de competição;
- treinamento;
- treinadores;
- instalações;
- profissionalismo;
- ambição;
- lesões;
- moral e contexto;
- adequação da função;
- capacidade de aprendizado.

### 13.2 Reposicionamento

Treinar nova posição deverá aumentar familiaridade e comportamento espacial. Atributos técnicos só evoluem por treinamento e desenvolvimento próprios.

Um meia poderá virar atacante se já possuir ou desenvolver:

- Movimento sem Bola;
- Finalização;
- Primeiro Toque;
- Compostura;
- Antecipação;
- familiaridade ofensiva.

### 13.3 Declínio

- velocidade e aceleração tendem a cair antes;
- técnica, decisões, visão e posicionamento podem se sustentar por mais tempo;
- condição natural e profissionalismo alteram curvas;
- lesões acumuladas podem acelerar perdas;
- mudança de função pode prolongar carreira.

### 13.4 Geração de novos atletas

O gerador deverá produzir:

- identidade e origem;
- corpo e pés coerentes;
- posição inicial;
- arquétipo parcial;
- atributos correlacionados, porém não idênticos;
- traços e personalidade;
- potencial incerto;
- possibilidades de reposicionamento;
- raridades estatisticamente controladas.

### 13.5 Estabilidade do mundo

Testar por centenas de temporadas:

- distribuição de atributos;
- inflação ou deflação de qualidade;
- quantidade de craques;
- cobertura de posições;
- longevidade;
- equilíbrio entre países e divisões;
- renovação de elencos;
- valores de mercado.

---

## 14. Mercado e scouting

### 14.1 Scouting como descoberta

O usuário não deverá receber certeza total imediatamente:

- atributos desconhecidos aparecem como intervalos;
- potencial possui incerteza;
- personalidade pode ser inferida;
- desempenho observado depende da qualidade da competição;
- função e encaixe tático precisam ser analisados;
- histórico e amostra importam.

### 14.2 Valor de mercado

Valor não será apenas nota geral:

- idade;
- contrato;
- posição e escassez;
- atributos raros;
- desempenho;
- reputação;
- potencial percebido;
- interesse de clubes;
- situação financeira;
- competição e nacionalidade;
- encaixe procurado.

### 14.3 Objetivo emocional

A janela deve produzir desejo de encontrar peças, não apenas trocar números maiores. O usuário deverá reconhecer que um jogador barato e específico pode transformar sua tática.

---

## 15. Registro de eventos

### 15.1 Estrutura mínima

```json
{
  "event_id": "evt_...",
  "match_id": "mat_...",
  "sequence": 184,
  "clock_ms": 4720000,
  "period": 2,
  "type": "shot",
  "team_id": "team_a",
  "actor_id": "player_9",
  "target_id": "player_11",
  "opponents": ["player_4", "keeper_b"],
  "origin": {"x": 71, "y": 42},
  "destination": {"x": 100, "y": 48},
  "outcome": "saved",
  "score_before": [1, 1],
  "score_after": [1, 1],
  "tags": ["dangerous_attack", "header"],
  "causes": ["cross_completed", "aerial_duel_won"],
  "rng_trace_id": "rng_..."
}
```

### 15.2 Tipos iniciais

- kickoff;
- possession_start;
- pass_attempt/completed/failed;
- carry;
- dribble_attempt/won/lost;
- cross;
- aerial_duel;
- interception;
- tackle;
- foul;
- advantage;
- card;
- set_piece;
- shot;
- block;
- save;
- rebound;
- goal;
- offside;
- injury;
- substitution;
- tactical_change;
- period_end;
- match_end.

### 15.3 Causalidade

Eventos importantes devem citar causas anteriores. Um gol poderá reconstruir sua cadeia:

```text
recuperação → passe → progressão → cruzamento → disputa aérea → gol
```

Isso alimenta replay, narração, estatísticas e “Entenda o resultado”.

---

## 16. Campinho 2D e experiência ao vivo

### 16.1 Princípio

O campo 2D não inventa futebol. Ele encena eventos confirmados.

### 16.2 Elementos

- 22 marcadores discretos;
- bola claramente distinguível;
- trave e rede;
- nome apenas do portador e envolvidos principais;
- trajetórias de passe, lançamento e chute;
- zonas de ataque sombreadas;
- estados como “Posse”, “Ataque” e “Ataque perigoso”;
- narração sincronizada;
- linha do tempo;
- outros placares da rodada;
- tabela provisória.

### 16.3 Sequência obrigatória de gol

1. construção reconhecível;
2. entrada em zona perigosa;
3. finalização com trajetória;
4. bola ultrapassa a linha e alcança a rede;
5. pausa visual curta;
6. confirmação forte de GOL;
7. autor, assistência, minuto e placar;
8. atualização da cronologia;
9. atualização dos demais jogos e tabela;
10. reinício no meio-campo.

### 16.4 Responsividade

- celular: campo + painel deslizante de eventos;
- tablet: campo dominante + dados complementares;
- desktop: campo e narração ao lado, rodada e tabela acessíveis;
- nenhum modo depende de 3D.

---

## 17. Narração por IA

### 17.1 Autoridade

A IA nunca decide o lance. Recebe eventos comprometidos e os interpreta.

### 17.2 Pacote narrativo

```text
minuto
placar antes/depois
atores
sequência causal
tipo de lance
consequência na competição
intensidade emocional permitida
```

### 17.3 Estratégia híbrida

- frases instantâneas e determinísticas para eventos comuns;
- variações de IA para contexto e emoção;
- síntese de voz opcional;
- preparação antecipada de pequenos segmentos;
- validação automática de nomes, minuto, placar e autor;
- fallback textual caso voz ou IA falhe.

### 17.4 Produto

Clássicos narrados podem servir como degustação gratuita e narração ampla como recurso premium, desde que a monetização permaneça exclusivamente na apresentação.

---

## 18. Transparência e confiança

### 18.1 Texto sugerido ao usuário

> **Como as partidas são simuladas**  
> As partidas do Eterno FC são calculadas lance a lance. Qualidade dos atletas, condição física, entrosamento, tática, mando e decisões durante o jogo alteram as probabilidades. Nenhum vencedor é escolhido antecipadamente e todos os clubes obedecem às mesmas regras. Um time superior possui vantagem, mas a vitória nunca é garantida.

### 18.2 “Entenda o resultado”

Após a partida, mostrar:

- qualidade e quantidade de oportunidades;
- finalizações e gols esperados calibrados;
- desempenho dos goleiros;
- erros e acertos decisivos;
- encaixes táticos;
- fadiga;
- bolas paradas;
- substituições;
- cadeia dos gols;
- impacto na classificação.

Não revelar fórmulas exploráveis; revelar causalidade suficiente para transmitir justiça.

---

## 19. Aleatoriedade, determinismo e justiça

### 19.1 Semente

Cada partida terá semente persistida. Mesma entrada, mesma versão do motor e mesma semente deverão produzir o mesmo registro.

### 19.2 Variância controlada

- sorte entra na resolução de confrontos;
- probabilidades vêm de atributos e contexto;
- eventos raros permanecem possíveis;
- limites evitam resultados grotescos;
- calibração substitui correções artificiais de placar.

### 19.3 Intervenção e ramificação

Ao mudar a tática:

- eventos passados continuam iguais;
- estado atual é preservado;
- futuro não comprometido é descartado;
- nova ramificação usa plano atualizado;
- a semente/fluxo aleatório deve permitir auditoria.

### 19.4 Regras de integridade

- sem ajuste oculto para manter campeonato apertado;
- sem força secreta por assinatura;
- sem punição por recarregar além de política explicitamente escolhida;
- sem gols produzidos apenas para adequar média estatística;
- sem atributos decorativos que não participam de nenhum comportamento.

---

## 20. Calibração e testes

### 20.1 Testes unitários

- cada atributo influencia somente ações pertinentes;
- pé fraco reduz qualidade na direção esperada;
- fadiga reduz execução gradualmente;
- familiaridade afeta comportamento posicional;
- traço altera frequência, não sucesso direto;
- nota geral não é lida pelos resolvers;
- goleiro não produz ação impossível;
- cartões respeitam o lance causador.

### 20.2 Testes de propriedade

- placar começa em 0–0;
- somente evento de gol altera placar;
- jogador substituído não participa depois da saída;
- expulso não volta;
- sequência de eventos é monotônica;
- estatísticas podem ser reconstruídas do ledger;
- replay com mesma semente é idêntico;
- velocidade visual não altera eventos;
- narração nunca contradiz evento;
- intervenção não modifica passado.

### 20.3 Cenários controlados

- times idênticos;
- favorito contra azarão;
- ataque forte contra defesa forte;
- lateral cruzador contra bloqueador de cruzamentos;
- centroavante aéreo contra zagueiros baixos;
- meia criativo contra bloco baixo;
- time cansado contra reservas frescos;
- goleiro excelente contra muitas chances;
- expulsão precoce;
- chuva/campo ruim, caso adotados;
- atleta fora de posição;
- atleta ambidestro versus especialista de um pé.

### 20.4 Simulação em massa

Executar milhares ou milhões de partidas sem UI para medir:

- gols por jogo;
- empates;
- frequência de zebras;
- mando;
- finalizações;
- qualidade das chances;
- passes e posse;
- cruzamentos;
- bolas paradas;
- cartões e expulsões;
- lesões;
- contribuição por posição;
- diferença entre divisões;
- dispersão de desempenho individual;
- impacto de táticas;
- existência de tática dominante.

Metas numéricas deverão ser obtidas de dados reais licenciados ou fontes públicas confiáveis e registradas por versão.

### 20.5 Testes de sensibilidade

Alterar um atributo por vez e medir:

- efeito local esperado;
- ausência de efeitos indevidos;
- magnitude não explosiva;
- ganho marginal acumulativo;
- comportamento em diferentes contextos.

### 20.6 Testes de raridade

- frequência de especialistas;
- frequência de jogadores completos;
- frequência de craques geracionais;
- variedade de arquétipos;
- ausência de clones;
- estabilidade por 100+ temporadas.

### 20.7 Testes de experiência

Snapshots isolados não bastam. Capturar sequências ou vídeo:

```text
posse → passe → ataque → finalização → gol/defesa → atualização → reinício
```

Validar ritmo, legibilidade, pausa, emoção, coerência e sincronização.

---

## 21. Observabilidade

Cada partida de teste deverá permitir inspecionar:

- semente;
- versão do motor;
- snapshots de entrada;
- opções percebidas;
- utilidades calculadas;
- ação escolhida;
- atributos participantes;
- modificadores;
- resultado probabilístico;
- evento emitido;
- projeções estatísticas;
- divergência entre evento e apresentação.

Em produção, detalhes sensíveis poderão ser reduzidos, mas o sistema interno deverá continuar auditável.

---

## 22. Estratégia de implementação

### Fase MP-0 — Contratos e verdade canônica

- definir escalas internas;
- schemas de jogador, equipe, tática, estado e evento;
- RNG com semente;
- `EventLedger`;
- replay determinístico;
- invariantes básicos.

**Saída:** uma partida vazia começa e termina com registro reproduzível.

### Fase MP-1 — Fatia vertical mínima

- dois times fixos;
- posse por fases;
- passe, interceptação, chute, defesa e gol;
- 10–12 atributos essenciais;
- estatísticas reconstruídas do ledger;
- nenhuma UI obrigatória.

**Saída:** resultado emerge de ações e pode ser explicado.

### Fase MP-2 — Jogadores e confrontos

- atributos técnicos, mentais e físicos completos;
- pés;
- pressão;
- fadiga;
- disputas aéreas;
- drible e desarme;
- goleiros.

**Saída:** especialistas produzem diferenças mensuráveis.

### Fase MP-3 — Tática e funções

- formação;
- funções;
- instruções coletivas e individuais;
- familiaridade;
- traços;
- substituições e mudanças durante o jogo.

**Saída:** decisões do treinador alteram o futuro sem garantir vitória.

### Fase MP-4 — Regras e competição

- faltas;
- cartões;
- impedimentos;
- bolas paradas;
- acréscimos;
- partidas simultâneas;
- tabela provisória.

### Fase MP-5 — Calibração

- harness de simulação em massa;
- baselines;
- métricas reais;
- testes de sensibilidade;
- eliminação de táticas dominantes e atributos inúteis.

### Fase MP-6 — Campinho 2D

- visualização do ledger;
- jogadores e bola;
- trajetórias;
- ritmo por modo;
- sequência de gol;
- responsividade;
- testes em vídeo.

### Fase MP-7 — Mundo persistente

- desenvolvimento;
- base;
- geração;
- declínio;
- aposentadoria;
- scouting;
- mercado;
- estabilidade multitemporada.

### Fase MP-8 — Narração e produto

- narração textual contextual;
- síntese de voz;
- validação factual;
- clássico gratuito experimental;
- opções premium de apresentação;
- medição de uso e custo.

---

## 23. Primeira prova funcional recomendada

Não começar com 40 atributos, todas as regras e centenas de clubes. Construir primeiro uma prova que demonstre a tese central:

1. criar dois times com onze jogadores;
2. usar atributos essenciais: Passe, Técnica, Visão, Decisões, Primeiro Toque, Movimento sem Bola, Posicionamento, Antecipação, Finalização, Desarme, Compostura e Resistência;
3. simular saída, construção, chance, chute, defesa e gol;
4. registrar cadeia causal;
5. reproduzir por semente;
6. comparar um lateral cruzador contra um marcador forte;
7. comparar um centroavante aéreo contra zagueiros diferentes;
8. executar 10.000 partidas automáticas;
9. confirmar que vantagem existe sem certeza de vitória;
10. somente depois ligar o campinho.

### Critério de aprovação da prova

- o placar não é escolhido previamente;
- cada gol possui cadeia causal válida;
- mudar atributos pertinentes altera frequências na direção esperada;
- atributos irrelevantes não alteram a ação;
- a mesma semente reproduz a partida;
- o time mais forte vence mais, mas não sempre;
- especialistas demonstram valor contextual;
- nenhum resultado depende da UI.

---

## 24. Questões em aberto

Estas decisões exigem protótipo e dados; não devem ser escolhidas por entusiasmo:

1. escala visível 1–20 ou 1–100;
2. precisão da escala interna;
3. quantidade inicial de atributos no MVP;
4. granularidade temporal das posses;
5. modelo estatístico de escolha e execução;
6. quantidade de eventos visíveis por velocidade;
7. força máxima de moral e confiança;
8. inclusão de clima e gramado;
9. profundidade de arbitragem;
10. exposição pública de notas gerais;
11. grau de incerteza do scouting;
12. frequência de talentos geracionais;
13. dados reais, licenciamento e uso de nomes, imagens, escudos e estatísticas;
14. custo e tecnologia da voz;
15. política de replay e recarregamento de saves.

---

## 25. Referências conceituais

As referências servem para estudo de princípios, não para copiar código, interface, base de dados, notas ou propriedade intelectual.

- Sports Interactive, *Football Manager 2024 Manual — Players*: atributos, combinações, decisões, posições, traços e desenvolvimento.  
  https://community.sports-interactive.com/sigames-manual/football-manager-2024/players-r4958/
- Sports Interactive, *Football Manager 2024 Manual — Tactics*: mentalidade, formação, funções, deveres e instruções.  
  https://community.sports-interactive.com/sigames-manual/football-manager-2024/tactics-r4960/
- Sports Interactive, *Football Manager 2024 Manual — Playing a Match*: apresentação, velocidades, destaques e intervenção tática.  
  https://community.sports-interactive.com/sigames-manual/football-manager-2024/playing-a-match-r4966/
- Elifoot: referência de simplicidade, carreira duradoura e valor emocional de jogadores emergentes.
- Globo Esporte e aplicativos de placar ao vivo: referências de tradução visual de eventos, linha do tempo e imersão 2D.

---

## 26. Frases-guia

> A nota geral descreve o jogador, mas não decide o lance.

> Posição define familiaridade; atributos definem capacidade; função define expectativa; contexto define oportunidade.

> Ver não é escolher. Escolher não é executar. Executar não é vencer o confronto.

> O campo 2D mostra o que o motor decidiu; ele não decide por conta própria.

> O time forte acumula vantagens, mas o futebol continua capaz de produzir surpresa.

> Craques não serão fabricados por rótulo: deverão emergir de combinações raras, desenvolvimento e contexto.

> O Eterno FC deverá unir a acessibilidade do Elifoot, a causalidade do Football Manager e a legibilidade de uma transmissão ao vivo.

