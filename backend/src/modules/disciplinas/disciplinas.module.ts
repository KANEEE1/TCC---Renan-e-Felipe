import { prisma } from "../../shared/prisma.js";
import { DisciplinasController } from "./disciplinas.controller.js";
import { DisciplinasRepository } from "./disciplinas.repository.js";
import { DisciplinasService } from "./disciplinas.service.js";

export const disciplinasRepository = new DisciplinasRepository(prisma);
export const disciplinasService = new DisciplinasService(disciplinasRepository);
export const disciplinasController = new DisciplinasController(disciplinasService);
