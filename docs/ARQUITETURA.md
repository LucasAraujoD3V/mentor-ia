# Arquitetura e operação

## Fluxo

Landing page → `login/` → autenticação → área principal → configurações. A página institucional mantém seus arquivos próprios. A aplicação usa HTML/CSS/JavaScript e rotas por hash; o servidor expõe JSON em `/api/` e usa SQLite com chaves estrangeiras.

O estado autenticado é obtido de `/api/me`. Não há token de sessão no localStorage. A sessão tem valor aleatório de 256 bits em cookie HttpOnly; só o hash fica no banco, com validade de 24 horas. Em produção o cookie usa Secure. Requisições de alteração exigem origem exata, tipo JSON e cabeçalho próprio, sem CORS.

## Autenticação

- Cadastro: validação → hash da senha → conta pendente → código por e-mail → confirmação → sessão.
- Login: senha → código por e-mail → sessão nova. A primeira etapa nunca concede acesso à API protegida.
- Códigos: seis dígitos, 10 minutos, uso único, finalidade/conta vinculadas e cinco tentativas. Reenvio invalida o código anterior da mesma finalidade. Há limites por IP e por conta no processo.
- Recuperação: resposta genérica para e-mail inexistente → código → nova senha → revogação de sessões.
- Alteração: senha atual (se a conta possui senha) → código → nova senha → revogação de sessões e emissão de uma nova para a sessão atual.
- Google: authorization code, state/cookie, PKCE, nonce, verificação local da assinatura do ID token com chave pública Google e validação de claims. Não são guardados access/refresh tokens. Segunda etapa por e-mail e aceite de documentos para novos cadastros.
- Cadastro pendente não confirmado é removido após 24 horas. Para pedir outro código de cadastro, entre com e-mail/senha ou use reenvio na tela de confirmação.

Limites em memória se reiniciam junto com o processo; contagem de erros do desafio fica no banco. Para operação distribuída, substituir limites locais e job por infraestrutura coordenada. Esta versão foi feita para uma única instância.

## Persistência

Tabelas: users, sessions, challenges, reviews, notices, deliveries e oauth. Exclusão de usuário remove dados associados por `ON DELETE CASCADE`. O SQLite utiliza WAL e secure_delete, mas não oferece garantia de remoção física de cópias antigas/backup; a política operacional deve contemplá-las. O arquivo do banco não é criptografado pela aplicação; permissões do disco, criptografia de volume e backups ficam a cargo da hospedagem.

Não há administrador universal ou senha padrão. Cada conta gerencia os próprios dados. A exportação não inclui hash de senha, códigos ou segredos de sessão. Identificação principal não é alterável pela API de perfil.

## E-mail e notificações

O adaptador envia mensagens via Resend quando configurado. Sem chave e remetente, em desenvolvimento, grava até 50 mensagens em memória; elas só são expostas pelo endpoint local, bloqueado em produção. O modo desenvolvimento escuta apenas em loopback e exige Host esperado.

Eventos opcionais: confirmação/novo acesso e atualização do perfil. Canal app cria avisos internos. Canal e-mail usa a fila para novas tentativas em caso de falha. Frequências diária/programada agrupam os eventos pendentes do usuário; diária: até 24h após o primeiro evento; programada: próxima ocorrência do horário em Brasília (UTC-3). O processador roda a cada 15 segundos. Falhas são tentadas até cinco vezes com intervalo de cinco minutos. Depois ficam pendentes para intervenção do operador (sem painel de monitoramento nesta versão).

Códigos de segurança nunca são adiados ou desativados pelas preferências. O envio real é obrigatório ao iniciar em produção. Após ligar ou reiniciar o serviço, entregas vencidas são processadas no próximo ciclo. Não há avisos push do sistema operacional nem WhatsApp.

## Arquivos públicos

O servidor usa lista explícita de arquivos públicos, protege caminhos e não serve .env, banco, código do servidor ou testes. A aplicação usa CSP sem scripts inline, proteção contra enquadramento e dados exibidos com escape de HTML. Fotos aceitam somente PNG/JPEG com limite de tamanho e conferência de assinatura do arquivo. Não há envio a armazenamento de terceiros.

## Fontes e integrações

Inter variável e Poppins 600 são distribuídas em `login/fonts/`, com licenças OFL. Não há carregamento de fontes de terceiros na interface. O Google só é acionado ao clicar no acesso alternativo, quando configurado. O contato por e-mail abre o cliente do usuário.

Referências: [Google OpenID Connect](https://developers.google.com/identity/openid-connect/openid-connect), [Resend — envio de e-mails](https://resend.com/docs/api-reference/emails/send-email).
