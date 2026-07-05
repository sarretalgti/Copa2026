# ⚽ Cromos Copa 2026 — Meu Álbum

App web (funciona no celular, instalável como PWA) para controlar o álbum de figurinhas
**Panini Copa do Mundo FIFA 2026** — no estilo do app "Cromos Copa do Mundo".

## O que ele faz

- **Índice completo do álbum**: 980 figurinhas — seção especial da Copa (FWC 1–20: troféu,
  mascotes e os 16 estádios) + as 48 seleções com numeração oficial por país (ex: BRA 1 a BRA 20),
  organizadas pelos 12 grupos (A a L).
- **Tenho / Faltam / Repetidas**: toque na figurinha para marcar. Modos rápidos:
  `✓ Tenho`, `+1 Repetida`, `−1 Repetida` e `✏️ Nomear` (para escrever o nome do jogador).
- **Controle de trocas**: aba com todas as repetidas disponíveis e botão "copiar lista"
  pronto para colar no grupo de trocas do WhatsApp. Idem para a lista de faltantes.
- **Busca**: por país, número (ex: `BRA 7`), nome do jogador ou grupo.
- **Resumo por país**: progresso de cada seleção com barra, faltantes e repetidas.
- **Agenda de jogos + resultados automáticos**: o app busca sozinho a tabela completa da
  Copa 2026 (11/jun a 19/jul) e os placares na API pública da ESPN, e guarda tudo offline.
  Atualiza automaticamente a cada 5 minutos com o app aberto.
- **Alerta de jogo**: toque no sininho 🔔 de qualquer jogo para ser avisado ~30 minutos
  antes do início (notificação do navegador + aviso no app).
- **Importação em massa**: cole sua lista de figurinhas e o app marca tudo de uma vez.
- **Backup**: exporta/restaura um arquivo `.json` com todo o seu progresso.

## Como usar

### Opção 1 — GitHub Pages (recomendado)
1. No GitHub, vá em **Settings → Pages**.
2. Em "Source", escolha **Deploy from a branch**, selecione a branch e a pasta `/ (root)`.
3. Abra o endereço gerado (`https://SEU-USUARIO.github.io/Copa2026/`) no celular.
4. No navegador, use "Adicionar à tela inicial" para instalar como app.

### Opção 2 — Local
Basta abrir o `index.html` em qualquer navegador (para a agenda de jogos e o service
worker funcionarem melhor, sirva por HTTP: `python3 -m http.server` na pasta do projeto).

## Como importar suas figurinhas

Na aba **💾 Dados**, cole sua lista — uma seleção por linha, aceitando código FIFA ou
nome do país, números soltos, intervalos e repetidas com `x`:

```
BRA: 1, 2, 5-9, 12x3     ← 12x3 = tenho 1 colada + 2 repetidas
FWC: 1-20
Argentina: 4 7 10
```

Há um campo separado só para repetidas, se preferir listar à parte.

## Observações

- Os dados ficam salvos no aparelho (localStorage). Use o backup para trocar de aparelho.
- Os nomes das figurinhas 2–20 de cada seleção vêm como "Jogador" — use o modo ✏️ Nomear
  para registrar os nomes conforme o seu álbum (a numeração oficial da Panini é por
  seleção, de 1 a 20).
- O alerta de jogo dispara com o app/site aberto (limitação de páginas web sem push server).
- Resultados: fonte pública da ESPN (`site.api.espn.com`). Se estiver sem internet,
  o app mostra a última agenda salva.
