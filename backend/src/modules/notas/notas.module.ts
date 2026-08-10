import { prisma } from "../../shared/prisma.js";
import { NotasController } from "./notas.controller.js";
import { NotasRepository } from "./notas.repository.js";
import { NotasService } from "./notas.service.js";

export const notasRepository = new NotasRepository(prisma);
export const notasService = new NotasService(notasRepository);
export const notasController = new NotasController(notasService);
