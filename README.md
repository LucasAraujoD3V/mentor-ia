> **Pacote portátil:** se você extraiu Mentor-IA-Completo, abra INICIAR-MENTOR-IA.cmd na pasta superior. O Node já está incluído. As instruções de instalação abaixo são para quem usar apenas a pasta de código-fonte.

# Mentor IA · aplicação Web · v0.2.0

Aplicação separada da landing page, com identidade baseada no manual visual: Inter, Poppins, verde #0FA83E / #00872F, amarelo #F5CC05 e azul #0B4BC0. Fontes incluídas localmente com suas licenças. A apresentação pública e seu slogan foram preservados.

**Não foi publicado nenhum site.** Este pacote contém código-fonte, servidor, banco criado automaticamente no primeiro uso, testes e documentação. Não contém contas prontas, banco de dados pessoal ou credenciais de terceiros.

## Começar no computador

1. Instale **Node.js 24.10 ou posterior**, de https://nodejs.org/.
2. Extraia o ZIP. Abra a pasta `mentor-ia-projeto`.
3. No Windows, abra `iniciar.cmd`. Alternativamente, abra um terminal nessa pasta e execute `npm start`.
4. Acesse **http://127.0.0.1:3000/** para a apresentação ou **http://127.0.0.1:3000/login/** para a aplicação.
5. Cadastre uma conta **com dados fictícios**. Na tela de confirmação, expanda “Desenvolvimento local · caixa de e-mails de teste” e clique em “Atualizar caixa local”. Copie o código de seis dígitos para confirmar o cadastro.
6. Após sair, o login exigirá a senha e um novo código. A mesma caixa permite testar recuperação, troca de senha e exclusão. Dentro da conta, ela fica em “Ajuda e suporte”.

Mantenha o servidor aberto durante o uso. Para parar, pressione Ctrl+C no terminal. Os dados continuam no arquivo `data/mentor.sqlite` ao reiniciar. Não é necessário `npm install`: o projeto usa bibliotecas nativas do Node, incluindo SQLite. Não abra `login/index.html` com duplo clique: a aplicação depende de HTTP e do servidor.

Caso apareça erro de porta ocupada, encerre o servidor anterior ou copie `.env.example` para `.env` e altere PORT e APP_ORIGIN de forma consistente. Use sempre o endereço configurado em APP_ORIGIN; `localhost` e `127.0.0.1` são origens diferentes para cookies e validação de requisições.

## O que funciona

- Cadastro com confirmação de e-mail; política de senha validada no navegador e servidor.
- Hash scrypt com salt individual; a senha original não é armazenada.
- Login com segunda etapa por código, expiração, limite de tentativas, sessão e logout.
- Recuperação e alteração de senha por código; revogação de sessões anteriores.
- Perfil com nome, escola, etapa e biografia; e-mail protegido no servidor; CPF não coletado.
- Foto PNG/JPEG até 500 KB, persistência e remoção. Plano de fundo não incluído (o requisito permite foto **e/ou** fundo).
- Notificações por aplicação ou e-mail; por evento, resumo diário e horário programado de Brasília. Avisos de atualização de perfil e novo acesso. O processador roda a cada 15 segundos e exige servidor em execução. Códigos de segurança são sempre imediatos.
- Temas claro/escuro e texto 100%, 112%, 125%, salvos por conta; preferência visual também mantida no dispositivo.
- Contato por e-mail, FAQ, informações da versão, estrelas e comentário com edição/exclusão pelo próprio usuário.
- Exportação em JSON e exclusão com senha atual (quando existente), código por e-mail e digitação de EXCLUIR; remoção em cascata dos dados ativos.
- Documentos internos de privacidade/termos, acessíveis antes do cadastro, e registro da versão aceita.

## O que depende de configuração externa

**E-mails:** por padrão, a entrega é simulada em memória, somente no servidor local. Não há entrega a caixas externas. Em produção, configure Resend. Sem essa configuração o servidor recusa iniciar em modo de produção.

**Google:** o fluxo OAuth/OpenID Connect está programado, mas o botão fica desabilitado sem credenciais. O fluxo real não foi testado com uma conta Google. Não é correto marcar o método alternativo como entregue e validado até configurá-lo e realizar esse teste. Não há vinculação automática a uma conta com senha que já use o mesmo e-mail; isso exigiria um fluxo autenticado específico.

**LGPD:** há mecanismos técnicos, minimização de dados e documentos iniciais. Isso não comprova conformidade jurídica integral. Antes de uso público: definir controlador, bases legais, fornecedores, retenção de backups, atendimento e processo adequado ao público menor de idade. Consulte `docs/REQUISITOS.md`.

Não estão incluídos: WhatsApp, biometria, chat de suporte ao vivo, IA pedagógica, painel do professor ou publicação automática. O enunciado aceita diferentes canais de contato e de confirmação; esta versão usa e-mail e código.

## Ativar envio real de e-mail

1. Crie uma conta no Resend e configure um remetente/domínio autorizado pelo provedor.
2. Copie `.env.example` para `.env` e preencha RESEND_API_KEY e MAIL_FROM.
3. Reinicie o servidor. O aviso de caixa local deixa de aparecer.
4. Teste o envio para uma caixa sob seu controle, spam, expiração e reenvio. O remetente e os destinatários permitidos dependem das regras da conta no provedor.

Não coloque chaves em `app.js`, no Git ou em arquivos públicos. O `.env` é ignorado pelo Git e não é servido pelo servidor.

## Ativar Google

1. No Google Cloud Console, configure a tela de consentimento e um cliente OAuth do tipo aplicação Web.
2. Cadastre a URI de retorno exata `http://127.0.0.1:3000/api/google/callback` para o ambiente local ou `https://SEU-DOMINIO/api/google/callback` para o servidor publicado. Se o provedor exigir localhost, ajuste também APP_ORIGIN e use essa origem para abrir a aplicação.
3. Preencha GOOGLE_CLIENT_ID e GOOGLE_CLIENT_SECRET no `.env`. Em modo de testes do Google, cadastre os usuários de teste necessários.
4. Reinicie e teste: consentimento, cancelamento, retorno, confirmação por código e novo acesso. Novas contas Google também precisam aceitar os documentos da versão acadêmica.

O servidor verifica state, PKCE, nonce, assinatura RS256, emissor, audiência e expiração do ID token. Depois exige um código por e-mail. Configuração não equivale a validação de ponta a ponta; registre o teste real antes de apresentar o método alternativo como concluído.

## Landing page e hospedagem

O servidor serve a apresentação em `/` e a aplicação em `/login/`. São interfaces e arquivos separados; a aplicação não depende do CSS da apresentação. O botão ENTRAR aponta para `login/`.

**O GitHub Pages sozinho não executa Node.js nem SQLite.** Se colocar o pacote lá, verá a interface de acesso com aviso de servidor indisponível; cadastro/login não funcionarão. Para uma versão pública funcional:

1. Hospede a aplicação em um serviço com Node.js 24.10+, disco persistente para SQLite e HTTPS. Use uma única instância para esta arquitetura.
2. Defina NODE_ENV=production, HOST conforme a plataforma, APP_ORIGIN com o domínio HTTPS exato, DATABASE_PATH no disco persistente e as variáveis de e-mail. Configure Google para esse domínio.
3. Não use arquivos efêmeros ou funções sem persistência para o banco. Configure backup, acesso restrito ao disco e descarte de backups conforme política definida.
4. Mantenha a landing page no GitHub Pages, se desejar. Nesse caso, altere **os dois** links `href="login/"` do `index.html` da apresentação para a URL completa da aplicação hospedada, como `https://SEU-DOMINIO/login/`. Um é compartilhado pela navegação desktop/menu mobile; o outro fica no cabeçalho mobile.
5. A aplicação e sua API devem ficar na mesma origem. A API não habilita CORS nem depende de cookies entre sites.
6. O link de volta à apresentação usa `../` por padrão (o servidor inclui a landing page). Se quiser voltar especificamente ao endereço no GitHub Pages, altere esses links no `login/app.js`.

As credenciais e a escolha de hospedagem não foram feitas nesta entrega. Nada foi enviado para GitHub ou para serviços de publicação.

## Testes e revisão

Execute `npm test`. A suíte usa contas fictícias e um banco temporário fora do projeto. Testes cobrem fluxos HTTP reais, segurança, persistência, fila de notificações, remoção em cascata, proteção de arquivos privados e estrutura das telas.

No navegador foram verificados acesso com segunda etapa, perfil, salvamento de dados, tema escuro e navegação desktop. Os layouts têm regras responsivas, mas a emulação visual em larguras móveis não foi concluída neste ambiente. Roteiro manual em `docs/ROTEIRO-DE-TESTE.md`.

## Organização

- `index.html`, `styles.css`, `script.js`, `assets/`: apresentação preservada, com botão ENTRAR.
- `login/`: interface independente, fontes locais e navegação por hash (sem regras de rewrite).
- `server/index.mjs`: rotas HTTP, validação de acesso, arquivos públicos e fila de notificações.
- `server/security.mjs`: senha, hashing, validação e geração de códigos.
- `server/db.mjs`: estrutura e acesso ao banco.
- `server/mail.mjs`: adaptador de e-mail real/local.
- `tests/`: verificações automatizadas.
- `docs/`: requisitos, arquitetura e roteiro para apresentação.

Base da apresentação: https://github.com/lucasaraujod3v/mentor-ia · commit `69135403943c11c196681d64a95f3cb07fb224b2`. Preserve alterações mais recentes do repositório antes de substituir arquivos. Este pacote é completo e substitui o protótipo de acesso anterior.
