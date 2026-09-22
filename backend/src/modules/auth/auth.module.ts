import { prisma } from "../../shared/prisma.js";
import { UsersRepository } from "../users/users.repository.js";
import { AuthController } from "./auth.controller.js";
import { AuthService } from "./auth.service.js";

const usersRepository = new UsersRepository(prisma);
export const authService = new AuthService(usersRepository);
export const authController = new AuthController(authService);
