import { gradeHorariaRepository } from "../grade-horaria/grade-horaria.module.js";
import { meetingsRepository } from "../meetings/meetings.module.js";
import { DashboardController } from "./dashboard.controller.js";
import { DashboardService } from "./dashboard.service.js";

export const dashboardService = new DashboardService(gradeHorariaRepository, meetingsRepository);
export const dashboardController = new DashboardController(dashboardService);
