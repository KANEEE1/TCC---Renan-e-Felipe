# Mapa de Empatia

Este documento mapeia, para cada perfil de usuário do sistema, o que ele pensa/sente, vê, ouve, fala/faz, além de suas dores e ganhos em relação ao processo atual (planilhas, mensagens, processos manuais) — antes da existência da plataforma.

O objetivo é validar se o backlog priorizado (`docs/lista-features/user-stories.md`, P0–P4) realmente endereça as dores reais de cada perfil, e não apenas funcionalidades assumidas sem verificação.

Aluno é tratado de forma diferente dos outros dois: como definido em `requisitos-nao-funcionais-e-lgpd.md`, ele não é usuário autenticado do sistema. Seu mapa de empatia não descreve "como ele usaria a plataforma", mas como a desorganização do processo atual o afeta — o que ainda justifica a existência do sistema, mesmo sem ele interagir diretamente com ele.

---

## Gestão

| Bloco | Conteúdo |
|---|---|
| **Pensa e sente** | Medo de "deixar passar" algo (aluno sem acompanhamento, sala sem professor); ansiedade por depender da boa vontade de voluntários para manter tudo funcionando; desejo de profissionalizar a operação sem burocratizá-la. |
| **Vê** | Planilhas divergentes mantidas por pessoas diferentes; grupos de WhatsApp com informação desencontrada; alta rotatividade de professores voluntários. |
| **Ouve** | Reclamação de professor sobre escala confusa; reclamação de aluno sobre aula cancelada sem aviso; comentários sobre outros cursinhos populares mais organizados. |
| **Fala e faz** | Tenta centralizar tudo numa planilha compartilhada; manda mensagens de cobrança recorrentes no grupo; assume tarefas administrativas manuais que tomam tempo de planejamento pedagógico. |
| **Dores** | Retrabalho de atualizar a mesma informação em vários lugares; falta de visibilidade de conflito de horário até ele acontecer; dependência de memória/boa vontade para avisar alguém de uma mudança. |
| **Ganhos** | Visão centralizada da operação (cadastro, grade, frequência); menos tempo em tarefas manuais repetitivas; confiança de que a informação está atualizada e acessível a quem precisa. |

## Professor

| Bloco | Conteúdo |
|---|---|
| **Pensa e sente** | Quer contribuir, mas tem pouco tempo disponível (concilia trabalho/estudo com o voluntariado); frustração quando sua disponibilidade muda e ninguém atualiza a grade; insegurança por não ter clareza se está cumprindo bem seu papel. |
| **Vê** | Grade horária desatualizada; pedidos de última hora para assumir uma aula; nenhum lugar único para ver a própria agenda. |
| **Ouve** | Pedidos informais da coordenação ("confirma por WhatsApp mesmo"); colegas comentando confusão de horário. |
| **Fala e faz** | Avisa disponibilidade por mensagem, sem registro formal; aceita ou recusa aula de forma improvisada; registra presença dos alunos em papel ou de forma inconsistente. |
| **Dores** | Falta de clareza sobre a própria agenda semanal; sensação de que o esforço voluntário não é bem aproveitado por causa da desorganização; medo de esquecer de avisar uma ausência a tempo. |
| **Ganhos** | Ver e atualizar a própria disponibilidade num lugar só; confiança de que, ao registrar algo (presença, disponibilidade), a informação chega a quem precisa sem esforço extra de comunicação. |

## Aluno (stakeholder, não usuário direto)

| Bloco | Conteúdo |
|---|---|
| **Pensa e sente** | Ansiedade pré-vestibular; insegurança quando uma aula é cancelada sem aviso; sensação de ser "só mais um número" quando o cursinho parece desorganizado. |
| **Vê** | Grupo de WhatsApp da turma como única fonte de informação, às vezes desatualizada; quadro de avisos físico. |
| **Ouve** | Colegas comentando sobre aula cancelada de última hora; professor avisando mudança de horário em cima da hora. |
| **Fala e faz** | Pergunta a colegas ou à coordenação quando não sabe se vai ter aula; se organiza com base em informação informal. |
| **Dores** | Perde tempo de estudo por informação desencontrada sobre horário/presença; sente que o cursinho, apesar do esforço dos voluntários, não passa confiança organizacional. |
| **Ganhos** | Previsibilidade da rotina de aulas; confiança de que presença e desempenho (simulados) são acompanhados de forma justa e consistente. |

---

## Conexão com o backlog

As dores mapeadas aqui já se refletem em user stories específicas do backlog — por exemplo: a dor de "falta de clareza sobre a própria agenda" (professor) corresponde à story P1 "visualizar minha agenda semanal"; a dor de "retrabalho de atualizar a mesma informação em vários lugares" (gestão) corresponde às stories de cadastro e grade horária centralizados (P0/P1). Essa correspondência é o que valida que o backlog P0–P4 endereça necessidades reais, não apenas funcionalidades assumidas.
