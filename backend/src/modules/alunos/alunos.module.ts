import { prisma } from "../../shared/prisma.js";
import { presencaService } from "../presenca/presenca.module.js";
import { simuladosService } from "../simulados/simulados.module.js";
import { AlunosController } from "./alunos.controller.js";
import { AlunosRepository } from "./alunos.repository.js";
import { AlunosService } from "./alunos.service.js";

export const alunosRepository = new AlunosRepository(prisma);
export const alunosService = new AlunosService(alunosRepository, presencaService, simuladosService);
export const alunosController = new AlunosController(alunosService);
