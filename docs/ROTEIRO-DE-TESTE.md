# Roteiro para apresentar e revisar

Use dados fictícios no ambiente local. Não utilize dados de alunos reais.

1. Abra a apresentação; confira slogan e seções. Clique em ENTRAR. A interface deve mudar para a aplicação, mantendo fontes e paleta.
2. Crie uma conta. Tente senha fraca e confirmação diferente. Confira que é preciso ler/aceitar os documentos e confirmar o e-mail.
3. Na caixa local, copie o código. Teste código incorreto, confirmação correta e tentativa de reutilização.
4. Saia. Tente entrar com senha errada; depois com a correta. Comprove que é preciso o novo código.
5. Em Minha conta, altere nome/escola/etapa/bio, salve e recarregue. Verifique e-mail não editável. Teste foto PNG/JPEG pequena e tentativa de arquivo inválido.
6. Em Notificações, selecione app/por evento. Atualize o perfil e confira o aviso na visão geral. Selecione resumo diário/programado e verifique a persistência; uma demonstração imediata do horário programado exige escolher o próximo minuto e aguardar o job. Não altere o relógio do computador.
7. Em Acessibilidade, alterne tema e fonte, salve e recarregue. Confira foco com Tab, Escape no menu mobile e zoom de 200%.
8. Em Ajuda e suporte, abra perguntas frequentes e confira nome/versão/equipe. O link de contato só deve abrir o cliente de e-mail; não há envio automático.
9. Em Avaliar, escolha cinco estrelas e comentário; salve, atualize para quatro e exclua.
10. Em Segurança, solicite troca de senha, consulte o código de teste em Ajuda e suporte, conclua e confira que a senha anterior deixou de funcionar. Use Cancelar para começar outro pedido se o código vencer.
11. Saia e use “Esqueci minha senha”. Redefina por código e entre com a nova senha.
12. Consulte Privacidade e Termos, inclusive pela tela pública. Exporte seus dados em JSON.
13. Solicite exclusão: senha atual, código e digitação de EXCLUIR. Antes da confirmação, confira a política de permanência e os efeitos da remoção. Depois, a sessão deve encerrar e a conta deixar de funcionar.
14. Pare e reinicie o servidor antes de excluir outra conta fictícia; confirme que seus dados persistem no SQLite.

## Responsividade e acessibilidade manual

Conferir 320, 375, 768, 1024 e 1440px. Até 800px, a aplicação troca a barra lateral pelo menu; a tela de acesso fica em coluna. Formulários devem caber sem rolagem horizontal. Conferir também teclado, labels, foco visível, zoom 200%, texto 125%, tema escuro e redução de movimento. Testar leitor de tela real antes de alegar conformidade de acessibilidade.

## Integrações externas pendentes

Após configurar e-mail real, repetir cadastro, login, reenvio, recuperação, troca e exclusão com uma caixa de teste controlada. Após configurar Google, testar entrada/cancelamento, criação de conta, aceite dos documentos, código por e-mail e caso de e-mail já existente. Essas verificações não foram realizadas nesta entrega.
