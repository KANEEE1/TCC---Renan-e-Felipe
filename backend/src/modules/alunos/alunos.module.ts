import { prisma } from "../../shared/prisma.js";
import { AlunosController } from "./alunos.controller.js";
import { AlunosRepository } from "./alunos.repository.js";
import { AlunosService } from "./alunos.service.js";

export const alunosRepository = new AlunosRepository(prisma);
export const alunosService = new AlunosService(alunosRepository);
export const alunosController = new AlunosController(alunosService);
