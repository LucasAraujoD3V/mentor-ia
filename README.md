# Mentor IA — apresentação local

**Link publicado:** https://lucasaraujod3v.github.io/mentor-ia/
**Brandbook:** https://lucasaraujod3v.github.io/mentor-ia/brandbook.html (PDF: `Brandbook-MentorIA.pdf`)

## Como abrir
1. Se recebeu o ZIP, extraia a pasta inteira. Ou abra direto o link publicado acima.
2. Abra `index.html` com dois cliques no Edge, Chrome ou Firefox.
3. Use F11 para tela cheia durante a apresentação. Clique em "Veja como funciona" e explore as quatro etapas.

Não é necessário instalar nada, iniciar servidor ou ter conexão com a internet. Mantenha `index.html`, `styles.css`, `script.js`, a pasta `assets/` e a imagem da logo (`20260922_223141000_iOS.jpg`) juntos. Os títulos usam Poppins e o texto usa Inter quando essas fontes estão instaladas, com Arial/Helvetica como alternativas locais.

## O que está entregue
- Landing page com a logo oficial em tela cheia no banner do topo e, logo abaixo, o título "Aprenda pensando. Evolua entendendo.", contexto, propósito, identidade e produto.
- Paleta do site e do brandbook tirada da própria logo: verde `#0FA83E`, amarelo `#F5CC05`, azul `#0B4BC0` e preto `#0A0A0A`.
- Missão, Visão e os seis Valores. **Atenção:** os textos atuais foram escritos nesta versão. Se o grupo tem a versão aprovada em outra conversa, é preciso colar em `index.html`, seção `#mvv`, e apagar a nota "Revise estes textos".
- Organograma com os quatro integrantes: Filipe Silva Avena e Lucas Araujo de Andrade em Tecnologia e Desenvolvimento, Victor Fernandes de Vasconcelos em Pesquisa e Documentação e Bruno Nascimento Rocha em Design e Experiência. Decisões compartilhadas.
- Público-alvo, funcionalidades propostas, benefícios pretendidos e diferenciais, sem alegar resultados comprovados.
- Plataforma Web, condições de acesso ainda em definição e demonstração interativa em quatro etapas.
- CTAs e contato real (`escolamentoria@outlook.com.br`, com link `mailto:`). As redes sociais continuam como planejamento.
- Brandbook com conceito, logotipo, slogan, paleta, tipografia, o mascote Menti e aplicações, em página web e em PDF de 8 páginas.
- HTML semântico, link "Pular para o conteúdo", foco visível, menu que funciona pelo teclado e fecha com Escape, feedback da demo anunciado para leitores de tela e respeito à preferência de movimento reduzido.

## Como apresentar — cinco partes, cerca de 5 minutos
Divisão combinada pelo grupo. Use os links do menu para ir direto a cada seção.

1. **Filipe — Abertura:** mostra o banner com a logo e o título. Apresenta o Mentor IA, o grupo e o que vai ser mostrado.
2. **Victor — Pesquisa e Documentação (seção Sobre):** apresenta o contexto (a IA entrega a resposta pronta), o público (ensino médio, de 14 a 18 anos, e professores) e a proposta de valor (pistas em vez de respostas). Explica que o projeto está em desenvolvimento e em validação.
3. **Lucas — Tecnologia e Desenvolvimento (seções Produto e Plataforma):** explica a integração aluno + professor + IA, o acompanhamento proposto, a plataforma Web e a expansão futura.
4. **Filipe — Demonstração:** clica em "Veja como funciona", digita `3` para mostrar a pista e depois `4` para mostrar a verificação, e responde `3` (a resposta certa). Explica que é uma simulação pré-programada.
5. **Bruno — Design e Experiência (seções Missão, Equipe e Contato):** apresenta a identidade (logo, cores e mascote), o slogan, a missão, a visão e os valores, o organograma e o planejamento de redes. Encerra retomando "Aprenda pensando. Evolua entendendo."

## Substituições futuras
- **Logo:** a imagem enviada pela equipe é `20260922_223141000_iOS.jpg`, na raiz. O banner e o rodapé mostram um recorte dela, só com o símbolo e o nome, feito em `.logo-full` no `styles.css`. Para trocar a logo, substitua esse arquivo com o mesmo nome e ajuste o recorte se as proporções mudarem.
- **Slogan:** a arte da logo diz "Aprenda hoje, evolua sempre.", enquanto o site e o roteiro usam "Aprenda pensando. Evolua entendendo.". O grupo precisa escolher um. Por isso o recorte da logo no site esconde o slogan dela.
- **Redes:** em `#redes`, transforme os blocos provisórios em links para os perfis reais depois de criá-los. Instagram e LinkedIn são sugestões de planejamento, não contas existentes.
- **Paleta:** as cores estão nas variáveis do início de `styles.css`.

## Testes realizados
Verificado no navegador Chromium do Claude Code, no link publicado:
- Nas larguras de 1440, 768, 390 e 320 pixels, a página não rola para os lados.
- O menu do celular abre e fecha com a tecla Escape, e o foco volta para o botão.
- Todos os links internos (`#sobre`, `#mvv`, `#produto`, `#demo`, `#equipe`, `#redes`, `#topo` e `#conteudo`) levam a seções que existem.
- A primeira tecla Tab cai no link "Pular para o conteúdo".
- A demo troca de etapa, reinicia e dá as respostas certa e errada.
- O link `mailto:` está correto, as 6 fotos e a logo carregam e o console não mostrou erros de JavaScript.
- Tiramos e conferimos capturas de tela do computador e do celular.

Não foi feita auditoria formal de acessibilidade (WCAG) nem teste com um leitor de tela real.

## Limites e próximos entregáveis da Semana 5
A landing page não tem login, IA real, envio de mensagens nem armazenamento de dados. A demonstração não faz diagnóstico e não mede desempenho real. Os perfis de redes sociais são placeholders.

A orientação da Semana 5 pede **link publicado, perfis/posts e banner impresso de 0,80 × 1,20 m**. Situação de cada um:
- **Link publicado:** feito, no GitHub Pages (link no topo deste arquivo).
- **Perfis/posts:** os perfis ainda não foram criados. O arquivo `REDES-SOCIAIS.md` tem três textos iniciais.
- **Banner impresso:** ainda precisa ser produzido e impresso. O brandbook traz a orientação de layout. Como o endereço público já existe, o QR Code do banner pode ser gerado apontando para o link acima.

Fotos: Unsplash (licença gratuita).
