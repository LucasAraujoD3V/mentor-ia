# Mentor IA — landing page (site-educa)

Landing page estática de trabalho da faculdade: **Mentor IA**, proposta de plataforma Web que orienta alunos do ensino médio com perguntas, pistas e verificação (slogan "Aprenda pensando. Evolua entendendo.").

## Estrutura
- `index.html`: página única. Seções: hero, sobre/contexto (#sobre), Missão/Visão/6 valores (#mvv), produto (#produto), demo em 4 etapas (#demo), plataforma, organograma (#equipe), contato/redes (#redes), footer.
- `styles.css`: paleta nas variáveis `:root` do topo. Layout inspirado no Ripper (hero em tela cheia, marquee, títulos em caixa alta, cards com foto), com código próprio.
- `script.js`: menu móvel (fecha com Escape), animação ao rolar (IntersectionObserver), demo simulada (digite 1 a 4 para trocar de etapa; na etapa 4 a resposta certa é 3).
- `assets/`: 6 fotos do Unsplash.
- `README.md`: como abrir, roteiro de apresentação, o que substituir. `REDES-SOCIAIS.md`: 3 textos de posts.

## Publicação
- GitHub Pages: repositório `LucasAraujoD3V/mentor-ia`, branch `main`, pasta raiz.
- Link privado do claude.ai: https://claude.ai/artifact/2CcSoRRziUGoxbuARr42mZ
- `ia.sv0001.com` ficou pendente: este PC ainda não tem acesso SSH ao SERVER (chave `server_deploy_lucaspc` criada, mas falta instalar a pública no servidor).

## Placeholders
MVV provisório, nomes da equipe, e-mail e perfis de redes. Não há login, IA real nem dados salvos.

## Configuracao
Todas as credenciais estão no `Cofre.md` na raiz da pasta `Data`, fora do versionamento e nunca postado no git. Este projeto não usa variáveis de ambiente.
