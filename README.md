# Mentor IA: apresentação local

## Como abrir
1. Se recebeu o ZIP, extraia a pasta inteira.
2. Abra `index.html` com dois cliques no Edge, Chrome ou Firefox.
3. Aperte F11 para deixar em tela cheia durante a apresentação. Clique em "Veja como funciona" e explore as quatro etapas.

Não precisa instalar nada, iniciar servidor nem ter internet. Mantenha `index.html`, `styles.css`, `script.js` e `assets/` juntos.

## Demonstração
- No campo, digite o número da etapa (1 a 4) e clique em "Ir". As abas de cima também trocam de etapa.
- Na etapa 2, digite `3` para mostrar a pista e depois `4` para ir à verificação.
- Na etapa 4, digite a resposta: `3` é a correta (2x + 4 = 10). Qualquer outro número mostra uma orientação. "Reiniciar" volta ao início.
- É uma simulação pré-programada. Não usa IA real, não faz diagnóstico e não mede desempenho.

## Como apresentar (4 falas, ~5 min, ~1min15 cada)
Use os links do menu para ir direto a cada seção.

1. **Victor Fernandes de Vasconcelos (Pesquisa e Documentação):** abre a apresentação.
   - Tela: banner com a logo, depois o título e a seção **Sobre**.
   - Fala: o problema (a IA entrega a resposta pronta e o aluno não aprende o caminho), o público (ensino médio, 14 a 18 anos, e professores) e a proposta de valor (pistas e perguntas em vez de respostas). Deixa claro que o projeto está em desenvolvimento e em validação.
2. **Filipe Silva Avena (Tecnologia e Desenvolvimento):** mostra o fluxo.
   - Tela: clica em **Veja como funciona** (seção Demonstração).
   - Faz: mostra as etapas 1 e 2, digita `3` e clica em Ir para mostrar a pista, depois digita `4` para ir à verificação e responde `3` (correto). Se quiser, testa um número errado para mostrar a orientação.
   - Fala: explica que é uma simulação pré-programada, sem IA real.
3. **Lucas Araujo de Andrade (Tecnologia e Desenvolvimento):** explica como funciona por dentro.
   - Tela: seção **Produto** (esquema Aluno → Mentor IA → Professor) e seção **Plataforma**.
   - Fala: a integração aluno + professor + IA, o acompanhamento do professor, a plataforma Web (sem instalar nada), as condições de acesso ainda em definição e a expansão futura (app, novas disciplinas, parcerias com escolas).
4. **Bruno Nascimento Rocha (Design e Experiência):** fecha a apresentação.
   - Tela: volta ao banner da logo, depois **Missão**, **Equipe** e **Contato**. Pode mostrar o `Brandbook-MentorIA.pdf`.
   - Fala: a identidade (cores verde, amarelo e azul, o significado da logo e o mascote Menti), o slogan, missão, visão e valores, o organograma e o planejamento de redes.
   - Encerra com: "Aprenda pensando. Evolua entendendo."

## Substituições futuras
- **Logo (aplicada):** a logo oficial (`20260922_223141000_iOS.jpg`, símbolo + nome, sem slogan) é o banner do topo (`.logo-banner`, logo em tela cheia sobre fundo preto) e aparece de novo no rodapé, via `.logo-full` em `styles.css` (recorte por CSS). O título, o texto e os botões ficam logo abaixo do banner, sobre a foto. O menu fica só com o nome em texto.
- **Equipe (preenchida):** Tecnologia e Desenvolvimento: Filipe Silva Avena e Lucas Araujo de Andrade. Pesquisa e Documentação: Victor Fernandes de Vasconcelos. Design e Experiência: Bruno Nascimento Rocha.
- **MVV:** confira os textos com a versão aprovada pelo grupo.
- **Contato (preenchido):** escolamentoria@outlook.com.br, com link `mailto:`.
- **Redes:** em `#redes`, transforme os blocos em links depois de criar os perfis.
- **Paleta:** as cores ficam nas variáveis do topo de `styles.css`.

## Limites
Não há login, IA real, envio de mensagens nem armazenamento de dados. Link publicado, perfis/posts e banner de 0,80 × 1,20 m ficam fora desta entrega. O QR Code do banner deve ser criado só depois que existir o endereço público.

Fotos: Unsplash (licença gratuita).
