# Kart 3D — Grand Prix 🏁

Jogo de kart em 3D no navegador, com **regras, mecânicas e números baseados no Mario Kart 64**
e visual retrô no estilo do Nintendo 64. Personagens, pistas, itens e músicas são **originais**:
só o jeito de jogar foi resgatado.

Feito com [Three.js](https://threejs.org/), sem etapa de build.

## Como jogar

| Teclado | Controle (USB) | Ação |
|---|---|---|
| `↑` ou `X` | A | Acelerar |
| `↓` ou `C` | B / X | Frear / ré |
| `←` `→` (ou `A` `D`) | Analógico / direcional | Virar |
| `Espaço` / `Shift` | RB / RT | Pulo — segure virando para derrapar |
| `Z` ou `E` | LB / LT | Usar item (segure para manter atrás de você) |
| `W` / `S` | Analógico ↑ / ↓ | Mirar o item para frente / para trás |
| `Esc` / `P` | Start | Pausa |
| `V` | | Alterna visual nítido (padrão: resolução cheia, antisserrilhado e sombras) e retrô (240 linhas) |
| `M` | | Liga/desliga o som |

No celular aparecem os botões A, B, R e Z na tela.

### Técnicas do 64
- **Mini-turbo**: pule e segure o pulo virando. Durante a derrapagem, **solte (ou vire para fora) e volte
  a virar para dentro**. Faça isso 2 vezes: a fumaça vai de **branca → amarela → vermelha**. Na vermelha, solte o pulo.
- **Largada turbo**: aperte o acelerador logo antes da **luz azul**. Se apertar cedo demais, o pneu fica cantando parado.
- **Escapar da casca**: frear no momento em que passa por uma casca de melancia, com o volante reto, evita a rodada.
- **Vácuo**: fique logo atrás de outro kart por alguns segundos para ganhar um empurrãozinho.
- **Toque triplo**: tocar rápido no acelerador, depois de uma batida, recupera a velocidade mais rápido.

## Modos
- **Grand Prix**: copa de 4 corridas com pontos e pódio (regras abaixo).
- **Corrida Livre**: escolha qualquer uma das 8 pistas e corra uma vez só. Guarda o seu recorde de tempo
  em cada pista e cilindrada.
- **Pilotos**: vitrine com o modelo 3D de cada piloto num pedestal. Arraste (mouse ou dedo) para girar 360°,
  role para aproximar, troque a pose (normal, virando, comemorando, atordoado). No teclado, ← → giram e
  ↑ ↓ trocam de piloto.

## Regras do Grand Prix (iguais ao 64)
- 8 pilotos, 3 voltas por corrida, copas com 4 pistas.
- **Copa Pistão** (Fazenda dos Silos, Porto dos Escafandros, Serra Gelada, Fundição do Vulcão) e **Copa Engrenagem**
  (Burgo do Vapor, Brejo das Caldeiras, Deserto da Sucata e Ilhas das Correntes), no mundo steampunk das artes conceituais.
- Cada pista tem a sua estrutura: viadutos cruzando a própria pista, espirais, saltos obrigatórios por cima de
  vãos e gretas, **caminhos alternativos** (por dentro do celeiro, pelo lago congelado, pela passarela sem mureta,
  pelos dois lados da torre do relógio) e **atalhos de salto arriscados** (a ponte levadiça erguida do porto e a
  rampa de escória da fundição: sem velocidade, o kart cai).
- Pontos: **9, 6, 3 e 1** para os 4 primeiros.
- Terminou em 5º ou pior? Não pontua e precisa **repetir a corrida**.
- Na primeira corrida você larga em 8º; nas seguintes, na ordem de chegada da anterior.
- Dois rivais são sorteados na copa e ficam "grudados" em você (o famoso elástico do 64).
- Cilindradas 50cc, 100cc e 150cc. Ganhe o ouro em 150cc para liberar o **modo Espelho** (100cc com a pista espelhada).
- Caiu na água, na lava ou de um penhasco? A **coruja** te busca e te devolve à pista.

## Pilotos (pesos do 64)

| Classe | Pilotos | Velocidade máx. 50/100/150cc* | Curva |
|---|---|---|---|
| Leve | Pipoca (coelha), Tico (sapo-cogumelo), Mel (gata) | 294 / 314 / 324 | 1.28 |
| Médio | Faísca (raposa), Bento (cão) | 290 / 310 / 320 | 1.25 |
| Pesado | Tonho (urso), Rino (rinoceronte), Juca (jacaré) | 290 / 310 / 320 | 1.15 |

\* Em unidades internas do 64. No velocímetro, 324 ≈ 70 km/h.

Cada piloto usa o peso, o "toque triplo" e o tamanho de um dos 8 originais
(Rino e Juca são maiores, como Wario e Bowser).
Leves aceleram mais rápido e perdem menos na grama. Médios têm a pior aceleração. Pesados empurram os outros.

## Itens (mesma função dos originais, outra roupagem)

| Aqui | Faz o mesmo que |
|---|---|
| Pimenta / 3 Pimentas / Pimenta Dourada | Cogumelo / 3 Cogumelos / Cogumelo Dourado |
| Casca de Melancia / Penca de Cascas (5) | Banana / Cacho de Bananas |
| Presente Falso | Caixa de item falsa |
| Coco / 3 Cocos | Casco verde / 3 cascos verdes (quica nos muros) |
| Abelha / 3 Abelhas | Casco vermelho / 3 cascos vermelhos (persegue quem está à frente) |
| Vespão | Casco espinhoso (vai atrás do 1º lugar) |
| Trovão | Raio (encolhe todos os outros) |
| Aura Dourada | Estrela (invencível e mais rápido) |
| Máscara Sombra | Boo (fica invisível e rouba um item) |

A chance de cada item por posição segue a tabela do 64 medida pela comunidade TASVideos.

### Itens dos rivais
Os pilotos do computador seguem a mesma regra do jogador: **só ganham um item ao passar por uma caixa**
(nada na largada) e só pegam outro depois de usar o anterior e passar por outra caixa. O sorteio vem de uma
tabela própria deles, e eles só usam **casca simples, presente falso, pimenta simples, aura, máscara sombra e trovão**,
nunca cocos, abelhas, vespão, itens triplos, penca ou pimenta dourada. No 150cc e no espelho, os 2 rivais da copa
se recuperam mais rápido quando são atingidos.

## De onde vêm os números
**Iguais ao original** (fontes: Super Mario Wiki e TASVideos): velocidade máxima por peso e cilindrada,
fator de curva por peso, pesos e "toque triplo" de cada piloto, duração do mini-turbo (14 quadros),
2 balanços para carregá-lo, duração do pulo (6 quadros), 3 voltas, 8 pilotos, pontos 9-6-3-1,
regra de repetir a corrida, modo espelho, a tabela de chance dos itens, os itens que os rivais podem usar
e o limite de 3 itens por volta para eles.

**Estimados** (não documentados publicamente, ajustados pelo comportamento do jogo):
curvas de aceleração, perda na grama, ganho de velocidade do mini-turbo e dos itens,
duração da estrela, do raio, do boo e das rodadas, a janela da largada turbo e a tabela de itens dos rivais
(do original só se sabe que a casca é 60% em 1º e o raio só 1% em 8º).
Todos ficam em `js/data.js`, fáceis de ajustar.

## Rodando no computador

```bash
python3 -m http.server 8000
```

Depois abra <http://localhost:8000>. O GitHub Pages também funciona sem configuração extra.

## Estrutura

```
js/data.js     regras, números, pilotos, itens e pistas
js/track.js    pistas com relevo, pontes, quedas, água/lava
js/branch.js   atalhos e caminhos alternativos (saem da pista, voltam ou terminam numa rampa de salto)
js/kit.js      peças comuns de cenário (galpões sobre a pista, texturas, fumaça, instâncias)
js/solids.js   colisão com o cenário: tudo que encosta na pista na altura do kart vira parede
js/granja.js   cenário da Fazenda dos Silos (cooperativa de bolotas a vapor)
js/porto.js    cenário do Porto dos Escafandros (escafandristas, submarinos, ponte levadiça)
js/geleira.js  cenário da Serra Gelada (Companhia de Gelo: depósito, teleférico, gretas, lago)
js/fundicao.js cenário da Fundição do Vulcão (galpão de fundição, poço de metal, escória)
js/textures.js texturas em pixel art pintadas à mão (pista, chão, barrancos, muros, água, lava)
js/oficina.js  cenário do Burgo do Vapor (cidade-oficina)
js/pantano.js  cenário do Brejo das Caldeiras (pântano com máquinas)
js/sucata.js   cenário do Deserto da Sucata (ferro-velho no deserto)
js/ilhas.js    cenário das Ilhas das Correntes (ilhas flutuantes)
js/bolota.js   máquinas e autômatos comuns da Copa Pistão (lampiões, canos de vapor, robôs)
js/viewer.js   vitrine dos pilotos em 3D (tela Pilotos)
js/robots.js   autômatos steampunk (robozinhos de lata e robô gigante; patrol() faz um robô andar e virar)
js/podium.js   pódio: praça de oficina com pedestais de cobre, arco de engrenagem e robôs
js/scenery.js  cenário: morros, marcos de cada pista, placas, arquibancadas, túneis e animações
js/kart.js     física: pulo, derrapagem, mini-turbo, muros, queda e resgate
js/items.js    caixas, roleta e todos os itens
js/ai.js       pilotos do computador
js/drivers3d.js modelos 3D dos pilotos, "fotografados" como sprites (32 ângulos x 5 poses)
js/sprites.js  ícones e sprites 2D dos itens
js/hud.js      painel da corrida
js/audio.js    sons e músicas chiptune originais
js/input.js    teclado, controle e toque
js/main.js     Grand Prix, câmera, menus e pódio
```

## Registro visual
Folhas comparando as versões dos pilotos e do cenário ficam em `docs/pilotos/` e `docs/cenario/`
(as pistas novas em `docs/cenario/engrenagem/`).

## Próximos passos
Contra o relógio com fantasma, batalha de balões e tela dividida para 2 jogadores.
