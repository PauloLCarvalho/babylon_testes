# babylon_testes
aprendizagem_babylon

## Como rodar

### Live Server (recomendado)
- Instale a extensão "Live Server" no VS Code.
- Abra `index.html` e clique em "Open with Live Server" (ou botão "Go Live").
- O projeto abrirá em `http://127.0.0.1:5500` (ou porta similar).

### Alternativa via Python
Se preferir um servidor simples:

```bash
cd /workspaces/babylon_testes
python3 -m http.server 5500
```

Depois, acesse: `http://localhost:5500`.

## Estrutura
- `index.html`: carrega Babylon.js via CDN e inicializa `engine`/`canvas`.
- `main.js`: exporta `createScene(engine, canvas)` e monta a cena.

## Detalhes técnicos
- `main.js` aceita `(engine, canvas)` e também funciona se `window.engine` e `window.canvas` estiverem definidos no `index.html`.
- Babylon.js é carregado via CDN (sem build/bundler).
