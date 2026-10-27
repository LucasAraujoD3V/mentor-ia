# Fase 3 · Funcionalidades e ferramentas do sistema

Versão 0.3.0 (27/10/2026). Módulo de estudos acrescentado sem reescrever as fases 1 e 2.

## Requisitos acrescentados à Engenharia e Modelagem

| Código | Requisito | Onde está |
|---|---|---|
| RF-301 | Cadastrar, listar, detalhar, editar e excluir **disciplinas** (nome, cor, meta semanal, descrição) | `server/estudos.mjs` rotas `disciplinas/*` · tela Disciplinas |
| RF-302 | Cadastrar, listar, detalhar, editar e excluir **sessões de estudo** (disciplina, data, duração, tema, situação, desempenho 1–5, anotações) | rotas `sessoes/*` · tela Sessões de estudo |
| RF-303 | Cadastrar, listar, detalhar, editar e excluir **dúvidas** (disciplina, sessão opcional, título, prioridade, situação, resolução) | rotas `duvidas/*` · tela Dúvidas |
| RF-304 | Busca simples (texto, sem diferenciar acento/maiúscula) e avançada (disciplina, situação, datas, duração, desempenho, prioridade, vínculo) | `filtros()` em `server/estudos.mjs` · formulários "Busca avançada" |
| RF-305 | Ordenação por coluna e paginação (5/10/25/50) | cabeçalhos clicáveis · `paginar()` em `server/estudos-db.mjs` |
| RF-306 | Painel com indicadores e 4 gráficos, filtros por período e disciplina | `painel()` · tela Painel de estudos · `login/js/graficos.js` |
| RF-307 | Relatórios PDF e XLSX a partir das consultas, com título, data de geração, filtros aplicados e dados consolidados | `server/relatorios.mjs` · botões "PDF" e "Excel" |
| RF-308 | Dados de exemplo fictícios e limpeza dos dados de estudo | rotas `exemplo` e `limpar` |
| RN-301 | Nome de disciplina único por usuário (ignora acento e maiúsculas) | `validarDisciplina()` + índice único |
| RN-302 | Sessão concluída exige desempenho e não pode ter data futura | `validarSessao()` (servidor e navegador) |
| RN-303 | Disciplina com sessões **não pode ser excluída** (bloqueio) | rota `disciplinas/excluir` + chave estrangeira sem cascata |
| RN-304 | Excluir disciplina sem sessões **exclui em cascata** as dúvidas dela | `ON DELETE CASCADE` |
| RN-305 | Excluir sessão **desvincula** as dúvidas (não as apaga) | `ON DELETE SET NULL` |
| RN-306 | Dúvida só pode ser vinculada a sessão da mesma disciplina; sessão com dúvidas não troca de disciplina | `validarDuvida()` / `validarSessao()` |
| RN-307 | Dúvida resolvida exige descrição da resolução; data de resolução registrada automaticamente | `validarDuvida()` |
| RN-308 | Cada usuário só acessa os próprios registros; excluir a conta remove todos os dados de estudo | `user_id` em todas as consultas + `ON DELETE CASCADE` |

## Modelo de dados (relacionamentos)

```
users 1 ──── N subjects (disciplinas)
subjects 1 ── N study_sessions   (exclusão bloqueada: FK composta sem cascata)
subjects 1 ── N questions        (exclusão em cascata)
study_sessions 0..1 ── N questions (SET NULL: desvincula)
```

- Chaves primárias `INTEGER AUTOINCREMENT`; chave estrangeira composta `(subject_id, user_id) → subjects(id, user_id)` garante no próprio banco que ninguém vincula sessão ou dúvida a disciplina de outro usuário.
- Índices: `study_sessions(user_id, day)`, `study_sessions(subject_id, status)`, `questions(user_id, status)`, `questions(subject_id)`, `questions(session_id)` e único `subjects(user_id, name COLLATE NOCASE)`.
- As tabelas são criadas automaticamente (`CREATE TABLE IF NOT EXISTS`) no banco existente; nenhum dado anterior é alterado.

## Painel (KPIs e gráficos)

| Indicador / gráfico | Tipo | Por quê |
|---|---|---|
| Tempo estudado | número em destaque | principal resultado do estudante |
| Cumprimento da meta | percentual + barra | compara o estudado com a soma das metas no período |
| Desempenho médio | número (1–5) | autoavaliação das sessões concluídas |
| Dúvidas pendentes | número | o que ainda precisa de atenção |
| Tempo por dia/semana | **linha** | evolução no tempo |
| Tempo por disciplina × meta | **barras** horizontais | comparação entre categorias; clique abre as sessões |
| Sessões por situação | **colunas** | contagem por categoria |
| Dúvidas por situação | **rosca (pizza)** | partes de um todo |

Filtros: últimos 7/30/90 dias, 12 meses ou período personalizado, e disciplina. Os dados são recalculados a cada acesso, filtro e registro. Cada gráfico tem dica ao passar o ponteiro/foco e uma tabela "Ver dados em tabela" (acessibilidade). Paleta validada para daltonismo nos temas claro e escuro.

## Relatórios

Disponíveis em Disciplinas, Sessões, Dúvidas e no Painel, sempre com os filtros da tela. PDF A4 paisagem (cabeçalho repetido em cada página, numeração "Página X de Y") e XLSX (datas e números como valores; aba principal + aba "Por disciplina"). Gerados no servidor, sem bibliotecas externas. Limite de 5.000 linhas por relatório, com aviso.

## Desempenho medido (testes automatizados, 3.000 sessões)

Consulta com busca e ordenação ≈ 20 ms · painel de 12 meses ≈ 6 ms · PDF ≈ 120 ms · XLSX ≈ 60 ms (máquina de desenvolvimento). Cada consulta exibe o tempo na tela ("consulta em X ms").

## Integração com o código existente

Arquivos novos: `server/estudos.mjs`, `server/estudos-db.mjs`, `server/relatorios.mjs`, `login/css/estudos.css`, `login/js/estudos.js`, `login/js/graficos.js`, `tests/estudos.test.mjs`, `tests/estudos-interface.test.mjs`, `tests/relatorios.test.mjs`, `tests/leitores.mjs`, este documento.

Linhas alteradas em arquivos existentes (somente ganchos, marcados com `// Fase 3`):

| Arquivo | Alteração |
|---|---|
| `server/index.mjs` | 1 `import` do módulo; 1 linha no início de `api()` encaminhando `/api/estudos/`; lista de arquivos públicos passa a incluir `css/estudos.css` e `js/*.js` |
| `login/index.html` | 3 linhas: folha de estilo e dois scripts novos |
| `login/app.js` | 1 linha em `render()` para exibir as telas do módulo |

Menu, ícones e títulos das novas telas são registrados pelo próprio `login/js/estudos.js`, sem editar as listas originais.

## Como demonstrar

1. `INICIAR-MENTOR-IA.cmd` → entre na conta → menu **Painel de estudos** → **Carregar dados de exemplo (fictícios)**.
2. Painel: troque período e disciplina; passe o ponteiro nos gráficos; clique numa barra.
3. Disciplinas: tente excluir uma com sessões (bloqueio). Crie uma nova, registre uma dúvida e exclua a disciplina (cascata).
4. Sessões: busca avançada (duração, desempenho, datas), ordene pelas colunas, troque a página. Exclua uma sessão com dúvida (desvínculo).
5. Gere PDF e Excel em qualquer consulta.
6. Painel → "Limpar meus dados de estudo" para recomeçar.

Testes: `TESTAR-PROJETO.cmd` ou `npm test` (30 testes, incluindo os 13 originais).
