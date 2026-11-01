import type { Express } from "express";
import { requireAuth, requireRole } from "../shared/auth.js";
import { alunosController } from "./alunos/alunos.module.js";
import { ausenciasController } from "./ausencias/ausencias.module.js";
import { authController } from "./auth/auth.module.js";
import { avisosController, avisosProfessorController } from "./avisos/avisos.module.js";
import { dashboardController } from "./dashboard/dashboard.module.js";
import { disciplinasController } from "./disciplinas/disciplinas.module.js";
import { disponibilidadeController } from "./disponibilidade/disponibilidade.module.js";
import { gradeHorariaController } from "./grade-horaria/grade-horaria.module.js";
import { matriculasController } from "./matriculas/matriculas.module.js";
import { meetingsController } from "./meetings/meetings.module.js";
import { notasController } from "./notas/notas.module.js";
import { presencaController } from "./presenca/presenca.module.js";
import { simuladosController } from "./simulados/simulados.module.js";
import { substituicoesController } from "./substituicoes/substituicoes.module.js";
import { teachersController } from "./teachers/teachers.module.js";
import { turmasController } from "./turmas/turmas.module.js";
import { usersController } from "./users/users.module.js";

export function registerRoutes(app: Express) {
  app.use("/auth", authController.router);
  app.use("/users", usersController.router);
  app.use("/teachers", teachersController.router);
  app.use("/dashboard", dashboardController.router);
  app.use("/alunos", alunosController.router);
  app.use("/students", alunosController.router);
  app.use("/turmas", turmasController.router);
  app.use("/classes", turmasController.router);
  app.use("/disciplinas", disciplinasController.router);
  app.use("/matriculas", matriculasController.router);
  app.use("/meetings", requireAuth, meetingsController.router);
  // Avisos do próprio professor (qualquer perfil autenticado); precisa vir antes de /notices, restrito à gestão.
  app.use("/notices/mine", requireAuth, avisosProfessorController.router);
  app.use("/notices", requireAuth, requireRole("GESTAO"), avisosController.router);
  app.use("/absences", requireAuth, ausenciasController.router);
  app.use("/substitutions", requireAuth, substituicoesController.router);
  app.use("/disponibilidade", disponibilidadeController.router);
  app.use("/grade-horaria", gradeHorariaController.router);
  app.use("/schedule", gradeHorariaController.router);
  app.use("/presencas", presencaController.router);
  app.use("/attendance", presencaController.router);
  app.use("/simulados", simuladosController.router);
  app.use("/notas", notasController.router);
  app.use("/grades", notasController.router);
}
