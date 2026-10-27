# Avaliação de atendimento · fases 1 e 2

Data: 19/10/2026. Versão: 0.2.0. Esta avaliação distingue código implementado, funcionamento verificado localmente e serviços externos pendentes. **Não há atendimento integral das duas fases até validar o Google e o envio real de e-mails, e concluir a revisão jurídica/operacional.**

| Requisito | Situação | Evidência ou limite |
|---|---|---|
| Splash, se aplicável | Implementado | Estado de carregamento ao iniciar |
| Tela inicial de acesso | Implementado | Interface independente da landing page |
| Cadastro | Funciona localmente | Registro no SQLite, confirmação obrigatória e versão dos documentos |
| Usuário e senha | Funciona localmente | Sessão só após senha e código válido |
| Método alternativo | Configuração e teste pendentes | Código Google OAuth/OIDC incluído; não houve credenciais reais |
| Senha forte protegida no banco | Implementado e testado | Hash scrypt com salt individual; hashing é usado no lugar de criptografia reversível |
| Confirmação em dois níveis | Funciona localmente | Senha + código de e-mail; entrega externa ainda precisa ser configurada/testada |
| Recuperação segura | Funciona localmente | Código único, expiração, nova senha e revogação de sessões |
| Visualizar cadastro | Implementado | Minha conta |
| Atualizar/complementar dados | Implementado e testado | Nome, escola, etapa e bio |
| Bloquear dados críticos | Implementado e testado | E-mail/ID rejeitados no backend; CPF não coletado |
| Foto e/ou fundo | Implementado | Foto com validação de formato/tamanho, armazenamento e remoção; fundo não necessário para atender “e/ou” |
| Canal de notificações | Implementado | Aplicação/e-mail/desativar; WhatsApp não implementado |
| Frequência de notificações | Implementado e fila testada | Evento, resumo diário e horário de Brasília; precisa de servidor continuamente em execução |
| Política de senha | Implementado | Cadastro e Segurança |
| Alteração segura da senha | Implementado e testado | Senha atual + código; contas Google sem senha usam código para definição |
| Fale conosco | Implementado | Link para e-mail real do projeto; nenhum contato foi enviado nesta tarefa |
| FAQ | Implementado | Perguntas e respostas internas |
| Sobre | Implementado | Nome, versão, equipe e tipo de distribuição; operador comercial não definido |
| Cinco estrelas e comentários gerenciáveis | Implementado e testado | Inserção, atualização e exclusão da própria avaliação; não há painel administrativo de moderação |
| Fonte e temas | Implementado | Texto 100/112/125%, claro/escuro, persistência por conta; tema conferido no navegador |
| Política de permanência | Implementado | Explica benefícios de permanecer e opção de desligar avisos |
| Exclusão com confirmação segura | Implementado e testado | Senha quando existente + código + EXCLUIR; cascata na base ativa |
| Política de Privacidade | Documento inicial | Publicamente acessível na interface, inclusive antes do cadastro |
| Termos de Uso | Documento inicial | Aceite e registro de versão; não substitui revisão jurídica |
| Adequação à LGPD | Parcial | Recursos técnicos e informações iniciais; faltam definições jurídicas, operacionais e para menores |
| Controle de versão | Preparado | `.gitignore` incluído; usar o repositório Git existente. Sem push/commit remoto nesta entrega |
| Validação frontend/backend | Implementado e testado | Regras de senha, perfil, imagem, preferências e avaliação |
| Tratamento de erros | Implementado | Mensagens de formulário, limite de tentativas e resposta genérica a falhas internas |
| Separação das responsabilidades | Implementado | Interface, servidor, segurança, envio de mensagens e persistência em módulos separados |
| Responsividade | Implementação revisada; verificação parcial | Desktop conferido no navegador; faltam capturas móveis em dispositivos/emulador |

## O que falta para marcar tudo como concluído

1. Configurar as credenciais Google e testar o fluxo real com um usuário autorizado, incluindo cancelamento e e-mail já cadastrado.
2. Configurar remetente e chave de envio de e-mails, verificando cadastro, acesso, recuperação, alteração e exclusão com entrega real.
3. Concluir revisão dos documentos e responsabilidades de proteção de dados. O público pretendido inclui menores: avaliar melhor interesse, base legal e participação dos responsáveis conforme o caso. Não há mecanismo de aferição de idade ou consentimento de responsável nesta versão.
4. Se houver publicação, definir hospedagem, HTTPS, backups, retenção, canal de atendimento aos titulares e resposta a incidentes. O GitHub Pages serve a apresentação, mas a aplicação precisa de backend.
5. Concluir a verificação manual em celulares e com tecnologia assistiva. Código com rótulos e foco não equivale a certificação de acessibilidade.

Fontes para a preparação dos documentos: [LGPD — texto oficial](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm), [ANPD — tratamento de dados de crianças e adolescentes](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-divulga-enunciado-sobre-o-tratamento-de-dados-pessoais-de-criancas-e-adolescentes). O atendimento integral exige avaliação do contexto concreto; não é confirmado apenas pela existência de telas.
