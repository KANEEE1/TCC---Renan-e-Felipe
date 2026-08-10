import { prisma } from "../../shared/prisma.js";
import { SimuladosController } from "./simulados.controller.js";
import { SimuladosRepository } from "./simulados.repository.js";
import { SimuladosService } from "./simulados.service.js";

export const simuladosRepository = new SimuladosRepository(prisma);
export const simuladosService = new SimuladosService(simuladosRepository);
export const simuladosController = new SimuladosController(simuladosService);
