import type { Express } from "express";
import { alunosController } from "./alunos/alunos.module.js";
import { authController } from "./auth/auth.module.js";
import { disciplinasController } from "./disciplinas/disciplinas.module.js";
import { disponibilidadeController } from "./disponibilidade/disponibilidade.module.js";
import { gradeHorariaController } from "./grade-horaria/grade-horaria.module.js";
import { matriculasController } from "./matriculas/matriculas.module.js";
import { notasController } from "./notas/notas.module.js";
import { presencaController } from "./presenca/presenca.module.js";
import { simuladosController } from "./simulados/simulados.module.js";
import { teachersController } from "./teachers/teachers.module.js";
import { turmasController } from "./turmas/turmas.module.js";
import { usersController } from "./users/users.module.js";

export function registerRoutes(app: Express) {
  app.use("/auth", authController.router);
  app.use("/users", usersController.router);
  app.use("/teachers", teachersController.router);
  app.use("/alunos", alunosController.router);
  app.use("/students", alunosController.router);
  app.use("/turmas", turmasController.router);
  app.use("/classes", turmasController.router);
  app.use("/disciplinas", disciplinasController.router);
  app.use("/matriculas", matriculasController.router);
  app.use("/disponibilidade", disponibilidadeController.router);
  app.use("/grade-horaria", gradeHorariaController.router);
  app.use("/schedule", gradeHorariaController.router);
  app.use("/presencas", presencaController.router);
  app.use("/simulados", simuladosController.router);
  app.use("/notas", notasController.router);
}
