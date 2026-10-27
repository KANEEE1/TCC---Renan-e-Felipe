import { prisma } from "../../shared/prisma.js";
import { disponibilidadeService } from "../disponibilidade/disponibilidade.module.js";
import { GradeHorariaController } from "./grade-horaria.controller.js";
import { GradeHorariaRepository } from "./grade-horaria.repository.js";
import { GradeHorariaService } from "./grade-horaria.service.js";

export const gradeHorariaRepository = new GradeHorariaRepository(prisma);
export const gradeHorariaService = new GradeHorariaService(gradeHorariaRepository, disponibilidadeService);
export const gradeHorariaController = new GradeHorariaController(gradeHorariaService);
