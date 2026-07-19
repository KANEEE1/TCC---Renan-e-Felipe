import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { createUserSchema } from "./users.schemas.js";
import type { UsersService } from "./users.service.js";

export class UsersController {
  readonly router = Router();

  constructor(private readonly usersService: UsersService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.usersService.list());
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const input = createUserSchema.parse(req.body);
      res.status(201).json(await this.usersService.create(input));
    }));
  }
}
