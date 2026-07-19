import { prisma } from "../../shared/prisma.js";
import { GradeHorariaController } from "./grade-horaria.controller.js";
import { GradeHorariaRepository } from "./grade-horaria.repository.js";
import { GradeHorariaService } from "./grade-horaria.service.js";

export const gradeHorariaRepository = new GradeHorariaRepository(prisma);
export const gradeHorariaService = new GradeHorariaService(gradeHorariaRepository);
export const gradeHorariaController = new GradeHorariaController(gradeHorariaService);
