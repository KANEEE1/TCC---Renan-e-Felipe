import { prisma } from "../../shared/prisma.js";
import { TurmasController } from "./turmas.controller.js";
import { TurmasRepository } from "./turmas.repository.js";
import { TurmasService } from "./turmas.service.js";

export const turmasRepository = new TurmasRepository(prisma);
export const turmasService = new TurmasService(turmasRepository);
export const turmasController = new TurmasController(turmasService);
