import { prisma } from "../../shared/prisma.js";
import { DisponibilidadeController } from "./disponibilidade.controller.js";
import { DisponibilidadeRepository } from "./disponibilidade.repository.js";
import { DisponibilidadeService } from "./disponibilidade.service.js";

export const disponibilidadeRepository = new DisponibilidadeRepository(prisma);
export const disponibilidadeService = new DisponibilidadeService(disponibilidadeRepository);
export const disponibilidadeController = new DisponibilidadeController(disponibilidadeService);
