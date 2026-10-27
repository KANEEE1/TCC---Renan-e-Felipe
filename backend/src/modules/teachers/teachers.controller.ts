import { Router, type NextFunction, type Request, type Response } from "express";
import { getActor, requireAuth } from "../../shared/auth.js";
import { asyncHandler, HttpError } from "../../shared/http.js";
import { createDisponibilidadeSchema, updateDisponibilidadeSchema } from "../disponibilidade/disponibilidade.schemas.js";
import type { DisponibilidadeService } from "../disponibilidade/disponibilidade.service.js";
import type { GradeHorariaService } from "../grade-horaria/grade-horaria.service.js";
import { createTeacherSchema, updateTeacherSchema } from "./teachers.schemas.js";
import type { TeachersService } from "./teachers.service.js";

const createAvailabilityForTeacherSchema = createDisponibilidadeSchema.omit({ professorId: true });

// Disponibilidade é do professor: só ele altera a própria (a gestão apenas consulta).
function requireSelf(req: Request, _res: Response, next: NextFunction) {
  if (getActor(req).id !== req.params.id) {
    throw new HttpError(403, "Somente o próprio professor pode alterar a disponibilidade");
  }

  next();
}

export class TeachersController {
  readonly router = Router();

  constructor(
    private readonly teachersService: TeachersService,
    private readonly disponibilidadeService: DisponibilidadeService,
    private readonly gradeHorariaService: GradeHorariaService
  ) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.teachersService.list());
    }));

    this.router.get("/:id", asyncHandler(async (req, res) => {
      res.json(await this.teachersService.getById(req.params.id as string));
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const input = createTeacherSchema.parse(req.body);
      res.status(201).json(await this.teachersService.create(input));
    }));

    this.router.put("/:id", asyncHandler(async (req, res) => {
      const input = updateTeacherSchema.parse(req.body);
      res.json(await this.teachersService.update(req.params.id as string, input));
    }));

    this.router.get("/:id/availability", asyncHandler(async (req, res) => {
      await this.teachersService.getById(req.params.id as string);
      res.json(await this.disponibilidadeService.listByProfessor(req.params.id as string));
    }));

    this.router.post("/:id/availability", requireAuth, requireSelf, asyncHandler(async (req, res) => {
      await this.teachersService.getById(req.params.id as string);
      const input = createAvailabilityForTeacherSchema.parse(req.body);
      res.status(201).json(
        await this.disponibilidadeService.create({ ...input, professorId: req.params.id as string })
      );
    }));

    this.router.put("/:id/availability/:availabilityId", requireAuth, requireSelf, asyncHandler(async (req, res) => {
      const input = updateDisponibilidadeSchema.parse(req.body);
      res.json(
        await this.disponibilidadeService.update(req.params.availabilityId as string, input, req.params.id as string)
      );
    }));

    this.router.delete("/:id/availability/:availabilityId", requireAuth, requireSelf, asyncHandler(async (req, res) => {
      await this.disponibilidadeService.remove(req.params.availabilityId as string, req.params.id as string);
      res.status(204).send();
    }));

    this.router.get("/:id/schedule", asyncHandler(async (req, res) => {
      await this.teachersService.getById(req.params.id as string);
      res.json(await this.gradeHorariaService.listByProfessor(req.params.id as string));
    }));
  }
}
