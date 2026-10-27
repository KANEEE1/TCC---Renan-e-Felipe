import { prisma } from "../../shared/prisma.js";
import { SubstituicoesController } from "./substituicoes.controller.js";
import { SubstituicoesRepository } from "./substituicoes.repository.js";
import { SubstituicoesService } from "./substituicoes.service.js";

export const substituicoesRepository = new SubstituicoesRepository(prisma);
export const substituicoesService = new SubstituicoesService(substituicoesRepository);
export const substituicoesController = new SubstituicoesController(substituicoesService);
