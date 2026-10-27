# Brain — Mentor IA

Plataforma Web acadêmica (ADS) para estudantes do ensino médio, focada em Matemática (as "disciplinas" do modelo aparecem como conteúdos de Matemática). Node.js 24 + SQLite nativo, sem dependências npm.

## Estrutura
- `index.html`, `styles.css`, `script.js`, `assets/`, `brandbook.html`: landing page (GitHub Pages).
- `login/`: aplicação (SPA por hash). `app.js`/`app.css` = fases 1–2; `js/estudos.js`, `js/graficos.js`, `css/estudos.css` = Fase 3.
- `server/index.mjs`: HTTP, autenticação, rotas das fases 1–2 e lista de arquivos públicos.
- `server/estudos.mjs` (rotas/regras), `server/estudos-db.mjs` (SQL), `server/relatorios.mjs` (PDF/XLSX): Fase 3.
- `server/db.mjs`, `security.mjs`, `mail.mjs`: banco, senha (scrypt), e-mail (Resend ou caixa local).
- `tests/`: `npm test` (30 testes). `docs/`: requisitos, arquitetura, roteiro, `FASE3.md`.

## Funcionalidades / telas
- Fase 1: cadastro, login com 2ª etapa por código de e-mail, recuperação de senha, Google OAuth (pendente de credenciais).
- Fase 2: perfil, foto, notificações, segurança, acessibilidade, suporte/FAQ/sobre, avaliação 5 estrelas, exclusão de conta, privacidade/termos.
- Fase 3: disciplinas, sessões de estudo, dúvidas (CRUD + relacionamentos), busca simples/avançada, ordenação, paginação, painel com KPIs e 4 gráficos, relatórios PDF/XLSX, dados de exemplo.

## Usuários
Estudante (cada conta só vê os próprios dados). Não há administrador nem senha padrão.

## Scripts
- `npm start` / `iniciar.cmd`: servidor em http://127.0.0.1:3000 (landing) e /login/ (app).
- `npm test`: testes automatizados.

## Hospedagem
GitHub Pages serve só a parte estática: a aplicação aparece com aviso "sem conexão com o servidor". Para funcionar online precisa de servidor Node 24.10+ com HTTPS, disco persistente e envio de e-mail (Resend) — ver README.

## Configuracao
Todas as credenciais estão no `Cofre.md` na raiz da pasta `Data`, fora do versionamento e nunca postado no git. `.env.example` mostra quais variáveis o projeto precisa.

## Produção (sv0001)
- Servidor **SERVER** (`192.168.0.176` / Tailscale `100.66.252.25`), pasta `C:\Mentor-IA` (código em `app\`, banco em `data\`, `.env` fechado, log `server.log`). Mesmo padrão do Painel CEO.
- Tarefa `Mentor-IA` (SERVIÇO LOCAL, na inicialização) roda `start.bat` → Node na porta **3021**, só loopback, `NODE_ENV=production`.
- **Publicar = `git push` na `main`**: a tarefa `Mentor-IA-AutoDeploy` (SYSTEM, a cada 2 min) roda `deploy/autodeploy.ps1`. Log: `C:\Mentor-IA\autodeploy.log`.
- Endereço: `https://mentor.sv0001.com` via Cloudflare Tunnel `umbrel-server` → `http://127.0.0.1:3021` (rota criada no painel da Cloudflare).
- E-mail: SMTP Gmail (porta 465) da conta já usada em outros projetos; IP real via cabeçalho `cf-connecting-ip` (`TRUST_PROXY_HEADER`).
