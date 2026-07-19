import { prisma } from "../../shared/prisma.js";
import { MatriculasController } from "./matriculas.controller.js";
import { MatriculasRepository } from "./matriculas.repository.js";
import { MatriculasService } from "./matriculas.service.js";

export const matriculasRepository = new MatriculasRepository(prisma);
export const matriculasService = new MatriculasService(matriculasRepository);
export const matriculasController = new MatriculasController(matriculasService);
