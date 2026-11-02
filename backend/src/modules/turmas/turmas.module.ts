import { prisma } from "../../shared/prisma.js";
import { matriculasService } from "../matriculas/matriculas.module.js";
import { presencaService } from "../presenca/presenca.module.js";
import { simuladosService } from "../simulados/simulados.module.js";
import { TurmasController } from "./turmas.controller.js";
import { TurmasRepository } from "./turmas.repository.js";
import { TurmasService } from "./turmas.service.js";

export const turmasRepository = new TurmasRepository(prisma);
export const turmasService = new TurmasService(turmasRepository, presencaService, simuladosService);
export const turmasController = new TurmasController(turmasService, matriculasService);
