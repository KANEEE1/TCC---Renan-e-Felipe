import { prisma } from "../../shared/prisma.js";
import { disponibilidadeService } from "../disponibilidade/disponibilidade.module.js";
import { gradeHorariaService } from "../grade-horaria/grade-horaria.module.js";
import { TeachersController } from "./teachers.controller.js";
import { TeachersRepository } from "./teachers.repository.js";
import { TeachersService } from "./teachers.service.js";

export const teachersRepository = new TeachersRepository(prisma);
export const teachersService = new TeachersService(teachersRepository);
export const teachersController = new TeachersController(
  teachersService,
  disponibilidadeService,
  gradeHorariaService
);
