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
| `V` | | Alterna visual retrô (240 linhas) e nítido |
| `M` | | Liga/desliga o som |

No celular aparecem os botões A, B, R e Z na tela.

### Técnicas do 64
- **Mini-turbo**: pule e segure o pulo virando. Durante a derrapagem, **solte (ou vire para fora) e volte
  a virar para dentro**. Faça isso 2 vezes: a fumaça vai de **branca → amarela → vermelha**. Na vermelha, solte o pulo.
- **Largada turbo**: aperte o acelerador logo antes da **luz azul**. Se apertar cedo demais, o pneu fica cantando parado.
- **Escapar da casca**: frear no momento em que passa por uma casca de melancia, com o volante reto, evita a rodada.
- **Vácuo**: fique logo atrás de outro kart por alguns segundos para ganhar um empurrãozinho.
- **Toque triplo**: tocar rápido no acelerador, depois de uma batida, recupera a velocidade mais rápido.

## Regras do Grand Prix (iguais ao 64)
- 8 pilotos, 3 voltas por corrida, copa com 4 pistas.
- Pontos: **9, 6, 3 e 1** para os 4 primeiros.
- Terminou em 5º ou pior? Não pontua e precisa **repetir a corrida**.
- Na primeira corrida você larga em 8º; nas seguintes, na ordem de chegada da anterior.
- Dois rivais são sorteados na copa e ficam "grudados" em você (o famoso elástico do 64).
- Cilindradas 50cc, 100cc e 150cc. Ganhe o ouro em 150cc para liberar o **modo Espelho** (100cc com a pista espelhada).
- Caiu na água, na lava ou de um penhasco? A **coruja** te busca e te devolve à pista.

## Pilotos (pesos do 64)

| Classe | Pilotos | Velocidade máx. 50/100/150cc* | Curva |
|---|---|---|---|
| Leve | Pipoca (coelha), Tico (sapo), Mel (gata) | 294 / 314 / 324 | 1.28 |
| Médio | Faísca (raposa), Bento (cão) | 290 / 310 / 320 | 1.25 |
| Pesado | Tonho (urso), Rino (rinoceronte), Juca (jacaré) | 290 / 310 / 320 | 1.15 |

\* Em unidades internas do 64. No velocímetro, 324 ≈ 70 km/h.
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

## De onde vêm os números
**Iguais ao original** (fontes: Super Mario Wiki e TASVideos): velocidade máxima por peso e cilindrada,
fator de curva por peso, pesos e "toque triplo" de cada piloto, duração do mini-turbo (14 quadros),
2 balanços para carregá-lo, duração do pulo (6 quadros), 3 voltas, 8 pilotos, pontos 9-6-3-1,
regra de repetir a corrida, modo espelho e a tabela de chance dos itens.

**Estimados** (não documentados publicamente, ajustados pelo comportamento do jogo):
curvas de aceleração, perda na grama, ganho de velocidade do mini-turbo e dos itens,
duração da estrela, do raio, do boo e das rodadas, e a janela da largada turbo.
Todos ficam em `js/data.js`, fáceis de ajustar.

## Rodando no computador

```bash
python3 -m http.server 8000
```

Depois abra <http://localhost:8000>. O GitHub Pages também funciona sem configuração extra.

## Estrutura

```
js/data.js     regras, números, pilotos, itens e pistas
js/track.js    pistas com relevo, pontes, quedas, água/lava e cenário
js/kart.js     física: pulo, derrapagem, mini-turbo, muros, queda e resgate
js/items.js    caixas, roleta e todos os itens
js/ai.js       pilotos do computador
js/sprites.js  pilotos montados em 3D e "fotografados" como sprites em 16 ângulos
js/hud.js      painel da corrida
js/audio.js    sons e músicas chiptune originais
js/input.js    teclado, controle e toque
js/main.js     Grand Prix, câmera, menus e pódio
```

## Próximos passos
Contra o relógio com fantasma, batalha de balões e tela dividida para 2 jogadores.
