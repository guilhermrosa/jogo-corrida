# Kart 3D 🏎️

Jogo de corrida de kart em 3D que roda direto no navegador, feito com [Three.js](https://threejs.org/).
Não precisa instalar nada nem compilar: é só HTML, CSS e JavaScript.

## Como jogar

| Tecla | Ação |
|---|---|
| `↑` / `W` | Acelerar |
| `↓` / `S` | Frear / dar ré |
| `←` `→` / `A` `D` | Virar |
| `Espaço` / `Shift` | Drift |
| `R` | Voltar para o centro da pista |
| `M` | Liga/desliga o som |
| `Esc` / `P` | Pausar |

No celular e no tablet aparecem botões na tela.

**Dica de drift:** segure o drift durante a curva. As faíscas mudam de cor
(branco → azul → laranja). Solte para ganhar um **mini-turbo**: azul dá um turbo curto, laranja dá um longo.
Passe também pelas **placas laranjas** na pista para ganhar velocidade.

## Recursos

- Circuito 3D com zebras, muros, arquibancada, pórtico de largada, árvores e montanhas
- 3 rivais controlados por IA, que freiam antes das curvas e brigam por posição
- Física arcade com drift, mini-turbo, placas de turbo e perda de velocidade na grama
- Contagem regressiva, voltas, cronômetro, melhor volta, posição e minimapa
- Escolha da cor do kart e do número de voltas (1, 3 ou 5)
- Sons gerados pelo próprio navegador (motor, turbo, batidas, largada)
- Tela de resultado com tempos de todos os pilotos

## Rodando no computador

Como o jogo usa módulos JavaScript, ele precisa ser aberto por um servidor local
(abrir o `index.html` direto com dois cliques não funciona). Na pasta do projeto:

```bash
python3 -m http.server 8000
```

Depois abra <http://localhost:8000> no navegador.

Se preferir Node.js:

```bash
npx serve .
```

## Publicando no GitHub Pages

1. No GitHub, vá em **Settings → Pages**.
2. Em **Source**, escolha **Deploy from a branch**, branch `main` e pasta `/ (root)`.
3. Salve. Em alguns minutos o jogo estará em `https://<seu-usuario>.github.io/jogo-corrida/`.

## Estrutura

```
index.html        página, HUD e menus
css/style.css     visual da interface
js/main.js        cena, câmera, estados do jogo e loop principal
js/track.js       geração da pista e do cenário
js/kart.js        modelo 3D e física dos karts
js/ai.js          pilotagem dos rivais
js/hud.js         painel da corrida e minimapa
js/input.js       teclado e controles de toque
js/audio.js       efeitos sonoros (Web Audio)
```

Para mudar o traçado do circuito, edite a lista `CONTROL` em `js/track.js`:
são os pontos (x, z) por onde a pista passa.
