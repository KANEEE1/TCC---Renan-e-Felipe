import { prisma } from "../../shared/prisma.js";
import { AvisosController } from "./avisos.controller.js";
import { AvisosRepository } from "./avisos.repository.js";
import { AvisosService } from "./avisos.service.js";

export const avisosRepository = new AvisosRepository(prisma);
export const avisosService = new AvisosService(avisosRepository);
export const avisosController = new AvisosController(avisosService);
