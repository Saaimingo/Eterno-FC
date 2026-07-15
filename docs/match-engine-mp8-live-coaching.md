# Motor de partida vNext — MP-8: decisões ao vivo do treinador

O MP-8 liga a área técnica ao motor causal. A partida deixa de ser apenas uma revelação passiva: enquanto acompanha o campinho e a narração, o treinador pode interferir no que ainda não aconteceu sem reescrever nenhum lance já visto.

## Regra de ouro: o passado é imutável

Ao receber uma decisão no minuto exibido, a aplicação agenda a intervenção no início do minuto seguinte e simula novamente a partida com a mesma entrada, versão e semente. Antes de aceitar o novo plano, compara todos os eventos já revelados — identidade, ordem, minuto, equipe, atletas, texto, resultado e placar.

Se qualquer item do prefixo mudar, a nova continuação é rejeitada. Assim, um comando aos 30 minutos não pode apagar um cartão aos 18, trocar o autor de um gol aos 24 ou alterar o placar que o usuário já viu.

## Comandos táticos

A área técnica oferece quatro leituras rápidas, pensadas para celular e sem transformar a partida em um painel empresarial:

- **Fechar a casa:** bloco mais baixo, menos risco e transição em contra-ataque;
- **Reequilibrar:** recupera distâncias, ritmo e circulação neutros;
- **Pressão total:** adianta linhas, sobe intensidade, risco e liberdade;
- **Explorar os lados:** amplia largura e direciona a criação para laterais e pontas.

Esses botões não concedem bônus abstratos nem garantem gols. Eles alteram escolhas coletivas que continuam dependendo dos atributos, funções, fadiga, adversário e contexto de cada lance.

## Substituições

O treinador escolhe quem sai e quem entra entre os atletas realmente relacionados. O reserva herda o espaço e a função da peça substituída, mas executa essa função com sua própria familiaridade posicional, seus atributos, pés, traços e condição.

O núcleo valida escalação, banco e limite de cinco trocas. Se uma ocorrência anterior tornar o jogador indisponível — por exemplo, uma expulsão — a troca não fabrica uma entrada: fica registrada como cancelada no ledger.

## Experiência visual

- aplicar uma decisão pausa o relógio para conferência;
- a confirmação informa o minuto e o comando registrado;
- mudança tática e substituição aparecem na narração quando entram em vigor;
- o campinho troca o atleta somente depois do evento canônico de substituição;
- o contador da área técnica mostra decisões e substituições utilizadas;
- o usuário decide quando retomar a partida.

## Testes de aceite

- o plano anterior e o novo são idênticos até o minuto revelado;
- a intervenção aparece apenas depois desse limite;
- a mesma lista de intervenções reproduz exatamente o mesmo resultado;
- atleta substituído deixa a seleção ativa e o reserva entra nela;
- o plano continua passando pelo portão oficial do vNext;
- decisões podem mudar o futuro, mas não garantem um resultado esportivo.
