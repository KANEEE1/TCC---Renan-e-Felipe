# Requisitos Não-Funcionais e LGPD

O backlog em `docs/lista-features/user-stories.md` cobre apenas requisitos funcionais. Este documento registra os requisitos não-funcionais (RNFs) e as considerações de LGPD (Lei nº 13.709/2018) que não aparecem em nenhum outro artefato, mas que moldam decisões de arquitetura já tomadas.

## Contexto que muda o tratamento de dado do aluno

O aluno **não é um usuário autenticado do sistema** — não faz login, não tem senha. Apenas gestão e professor autenticam (ver `tecnologias.md`). O aluno é **titular de dado**: seus dados (nome, turma, presença, notas de simulados) são inseridos e mantidos por terceiros (professor ou gestão), nunca por ele mesmo.

Isso tem duas consequências diretas:

1. **Consentimento é obtido fora do sistema**, presumivelmente no momento da matrícula (formulário físico ou digital fora da plataforma) — o sistema não precisa de um fluxo de consentimento embutido, já que o titular nunca interage com ele diretamente.
2. **Auditoria de quem inseriu/alterou o dado ganha peso maior**: como o próprio aluno nunca confere seus dados pelo sistema, é a trilha de auditoria (não uma tela de "meus dados") que garante responsabilização em caso de erro ou contestação.

Alunos de cursinho pré-vestibular têm tipicamente entre 16 e 19 anos — parte do público é, portanto, menor de idade, o que aciona a regra especial da LGPD para dados de crianças e adolescentes (art. 14).

## Requisitos Não-Funcionais

| Categoria | Requisito |
|---|---|
| Desempenho | Escala pequena (dezenas de usuários simultâneos — gestão e professores). Não há necessidade de otimizar para alta concorrência. |
| Disponibilidade | Uso concentrado em horário escolar/comercial. Não é um sistema crítico 24/7; não requer SLA de alta disponibilidade. |
| Segurança | Hash de senha (bcrypt), expiração de token JWT, HTTPS em produção, e controle de acesso por escopo: um professor vê nome/presença/notas apenas dos alunos das próprias turmas, não do cursinho inteiro. |
| Usabilidade | Professores são voluntários e podem não ter familiaridade técnica alta — interface simples é requisito, não só preferência estética. |
| Confiabilidade | Presença e notas são registros acadêmicos relevantes — requer política mínima de backup do PostgreSQL. |
| Auditoria | Registro de quem inseriu/alterou presença e notas de simulado, dado que o titular (aluno) nunca verifica esse dado por conta própria. |
| Escalabilidade | **Explicitamente fora de escopo.** Não há necessidade de projetar para crescimento além de um único cursinho popular. |

## LGPD

### Dados pessoais de aluno tratados pelo sistema

Nome, turma, presença, notas de simulados. Nenhuma credencial de login (sem e-mail/senha de aluno).

### Base legal para tratamento

A base legal aplicável é a execução de um serviço educacional (o cursinho), complementada, para os alunos menores de idade, pelo consentimento dos responsáveis legais nos termos do art. 14 da LGPD — obtido fora do sistema, no momento da matrícula.

### Dados sensíveis — não se aplica, mas com ressalva

Nome, presença e notas **não são "dados sensíveis"** pela definição do art. 5º, II da LGPD (que cobre origem racial, convicção religiosa, dado de saúde, biometria, etc.). Nota de desempenho é, em sentido coloquial, mais delicada que presença — vale essa distinção estar clara na dissertação para não confundir os dois sentidos de "sensível".

### Minimização de dados

O sistema deve coletar apenas nome, turma, presença e notas de simulados sobre o aluno — evitar campos adicionais (CPF, endereço, telefone) que não sejam exigidos por uma funcionalidade já prevista no backlog.

### Retenção e eliminação

A definir uma política simples de retenção (ex.: dados de presença e notas mantidos por um período após o aluno deixar o cursinho, depois eliminados ou anonimizados). Não é necessário um mecanismo automatizado complexo no MVP — uma política documentada e um processo manual já atendem ao requisito nesta fase do projeto.

### Direitos do titular

Como o aluno não acessa o sistema diretamente, o exercício de direitos (acesso, correção, exclusão — art. 18 da LGPD) acontece por meio da gestão: o aluno ou responsável solicita fora do sistema, e a gestão executa a alteração dentro da plataforma. Não é necessário construir uma tela de autoatendimento para isso no MVP — documentar o processo já é suficiente.

### Encarregado de dados (DPO)

A LGPD exige a designação de um encarregado pelo tratamento de dados. No contexto do TCC, isso é uma nota organizacional (quem exerceria esse papel num cursinho real) e não um requisito de implementação no sistema.
