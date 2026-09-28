import { gradeHorariaRepository } from "../grade-horaria/grade-horaria.module.js";
import { simuladosRepository } from "../simulados/simulados.module.js";
import { turmasRepository } from "../turmas/turmas.module.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardService } from "./dashboard.service.js";

export const dashboardService = new DashboardService(turmasRepository, gradeHorariaRepository, simuladosRepository);
export const dashboardController = new DashboardController(dashboardService);
