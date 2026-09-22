# Mentor IA — landing page (site-educa)

Landing page estática de trabalho da faculdade: **Mentor IA**, proposta de plataforma Web que orienta alunos do ensino médio com perguntas, pistas e verificação (slogan "Aprenda pensando. Evolua entendendo.").

## Estrutura
- `index.html`: página única. Seções: hero, sobre/contexto (#sobre), Missão/Visão/6 valores (#mvv), produto (#produto), demo em 4 etapas (#demo), plataforma, organograma (#equipe), contato/redes (#redes), footer.
- `styles.css`: paleta nas variáveis `:root` do topo, com as cores da logo (verde #0FA83E, verde escuro #00872F para botões/texto sobre branco, amarelo #F5CC05, azul #0B4BC0, preto #0A0A0A). Títulos em Poppins, texto em Inter (fallback Arial). Layout inspirado no Ripper (hero em tela cheia, marquee, títulos em caixa alta, cards com foto), com código próprio.
- `script.js`: menu móvel (fecha com Escape), animação ao rolar (IntersectionObserver), demo simulada (digite 1 a 4 para trocar de etapa; na etapa 4 a resposta certa é 3).
- `assets/`: 6 fotos do Unsplash.
- `brandbook.html`: manual de marca (conceito, logo, slogan, paleta tirada da logo `20260922_223141000_iOS.jpg`, tipografia Poppins/Inter, mascote Menti em SVG, aplicações). Paleta: verde #0FA83E, azul #0B4BC0, amarelo #F5CC05, verde claro #22C10D, preto #0A0A0A. O slogan da logo ("Aprenda hoje, evolua sempre.") diverge do slogan do site; o grupo precisa escolher um.
- `Brandbook-MentorIA.pdf`: PDF de 8 páginas do brandbook, gerado com Edge headless (`msedge --headless=new --no-pdf-header-footer --print-to-pdf=... brandbook.html`).
- `README.md`: como abrir, roteiro de apresentação, o que substituir. `REDES-SOCIAIS.md`: 3 textos de posts.

## Publicação
- GitHub Pages: repositório `LucasAraujoD3V/mentor-ia`, branch `main`, pasta raiz.
- Link privado do claude.ai: https://claude.ai/artifact/2CcSoRRziUGoxbuARr42mZ
- `ia.sv0001.com` ficou pendente: este PC ainda não tem acesso SSH ao SERVER (chave `server_deploy_lucaspc` criada, mas falta instalar a pública no servidor).

## Equipe e contato
- Tecnologia e Desenvolvimento: Filipe Silva Avena, Lucas Araujo de Andrade. Pesquisa e Documentação: Victor Fernandes de Vasconcelos. Design e Experiência: Bruno Nascimento Rocha (papéis distribuídos pela ordem em que os nomes foram passados; confirmar com o grupo).
- E-mail do projeto: escolamentoria@outlook.com.br.

## Placeholders
MVV provisório e perfis de redes. Não há login, IA real nem dados salvos.

## Configuracao
Todas as credenciais estão no `Cofre.md` na raiz da pasta `Data`, fora do versionamento e nunca postado no git. Este projeto não usa variáveis de ambiente.
