import { prisma } from "../../shared/prisma.js";
import { simuladosService } from "../simulados/simulados.module.js";
import { AvisosController } from "./avisos.controller.js";
import { AvisosProfessorController } from "./avisos-professor.controller.js";
import { AvisosProfessorRepository } from "./avisos-professor.repository.js";
import { AvisosProfessorService } from "./avisos-professor.service.js";
import { AvisosRepository } from "./avisos.repository.js";
import { AvisosService } from "./avisos.service.js";

export const avisosRepository = new AvisosRepository(prisma);
export const avisosService = new AvisosService(avisosRepository, simuladosService);
export const avisosController = new AvisosController(avisosService);

export const avisosProfessorRepository = new AvisosProfessorRepository(prisma);
export const avisosProfessorService = new AvisosProfessorService(avisosProfessorRepository, simuladosService);
export const avisosProfessorController = new AvisosProfessorController(avisosProfessorService);
