import { prisma } from "../../shared/prisma.js";
import { PeriodosLetivosController } from "./periodos-letivos.controller.js";
import { PeriodosLetivosRepository } from "./periodos-letivos.repository.js";
import { PeriodosLetivosService } from "./periodos-letivos.service.js";

export const periodosLetivosRepository = new PeriodosLetivosRepository(prisma);
export const periodosLetivosService = new PeriodosLetivosService(periodosLetivosRepository);
export const periodosLetivosController = new PeriodosLetivosController(periodosLetivosService);
