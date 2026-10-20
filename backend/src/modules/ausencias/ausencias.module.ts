import { prisma } from "../../shared/prisma.js";
import { AusenciasController } from "./ausencias.controller.js";
import { AusenciasRepository } from "./ausencias.repository.js";
import { AusenciasService } from "./ausencias.service.js";

export const ausenciasRepository = new AusenciasRepository(prisma);
export const ausenciasService = new AusenciasService(ausenciasRepository);
export const ausenciasController = new AusenciasController(ausenciasService);
