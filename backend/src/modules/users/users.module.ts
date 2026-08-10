import { prisma } from "../../shared/prisma.js";
import { UsersController } from "./users.controller.js";
import { UsersRepository } from "./users.repository.js";
import { UsersService } from "./users.service.js";

export const usersRepository = new UsersRepository(prisma);
export const usersService = new UsersService(usersRepository);
export const usersController = new UsersController(usersService);
