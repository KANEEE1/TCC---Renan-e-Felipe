import { Router } from "express";
import { getActor } from "../../shared/auth.js";
import { asyncHandler } from "../../shared/http.js";
import { createMeetingSchema, updateMeetingSchema } from "./meetings.schemas.js";
import type { MeetingsService } from "./meetings.service.js";

export class MeetingsController {
  readonly router = Router();

  constructor(private readonly meetingsService: MeetingsService) {
    this.router.get("/", asyncHandler(async (req, res) => {
      const actor = getActor(req);
      res.json(await this.meetingsService.list(actor));
    }));

    this.router.get("/:id", asyncHandler(async (req, res) => {
      const actor = getActor(req);
      res.json(await this.meetingsService.getById(req.params.id as string, actor));
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const actor = getActor(req);
      const input = createMeetingSchema.parse(req.body);
      res.status(201).json(await this.meetingsService.create(input, actor));
    }));

    this.router.put("/:id", asyncHandler(async (req, res) => {
      const actor = getActor(req);
      const input = updateMeetingSchema.parse(req.body);
      res.json(await this.meetingsService.update(req.params.id as string, input, actor));
    }));

    this.router.delete("/:id", asyncHandler(async (req, res) => {
      const actor = getActor(req);
      await this.meetingsService.remove(req.params.id as string, actor);
      res.status(204).end();
    }));
  }
}
