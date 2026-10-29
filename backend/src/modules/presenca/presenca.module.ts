import { prisma } from "../../shared/prisma.js";
import { gradeHorariaRepository } from "../grade-horaria/grade-horaria.module.js";
import { PresencaController } from "./presenca.controller.js";
import { PresencaRepository } from "./presenca.repository.js";
import { PresencaService } from "./presenca.service.js";

export const presencaRepository = new PresencaRepository(prisma);
export const presencaService = new PresencaService(presencaRepository, gradeHorariaRepository);
export const presencaController = new PresencaController(presencaService);
