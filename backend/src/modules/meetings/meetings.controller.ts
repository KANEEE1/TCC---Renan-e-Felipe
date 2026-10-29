import { Router } from "express";
import { getActor, requireRole } from "../../shared/auth.js";
import { asyncHandler } from "../../shared/http.js";
import { createMeetingSchema, rsvpSchema, updateMeetingSchema } from "./meetings.schemas.js";
import type { MeetingsService } from "./meetings.service.js";

export class MeetingsController {
  readonly router = Router();

  constructor(private readonly meetingsService: MeetingsService) {
    this.router.get("/", asyncHandler(async (req, res) => {
      const actor = getActor(req);
      res.json(await this.meetingsService.list(actor));
    }));

    this.router.get("/participant-options", requireRole("GESTAO"), asyncHandler(async (_req, res) => {
      res.json(await this.meetingsService.listParticipantOptions());
    }));

    this.router.get("/:id", asyncHandler(async (req, res) => {
      const actor = getActor(req);
      res.json(await this.meetingsService.getById(req.params.id as string, actor));
    }));

    this.router.post("/", requireRole("GESTAO"), asyncHandler(async (req, res) => {
      const actor = getActor(req);
      const input = createMeetingSchema.parse(req.body);
      res.status(201).json(await this.meetingsService.create(input, actor));
    }));

    this.router.put("/:id", requireRole("GESTAO"), asyncHandler(async (req, res) => {
      const actor = getActor(req);
      const input = updateMeetingSchema.parse(req.body);
      res.json(await this.meetingsService.update(req.params.id as string, input, actor));
    }));

    this.router.put("/:id/rsvp", asyncHandler(async (req, res) => {
      const actor = getActor(req);
      const input = rsvpSchema.parse(req.body);
      res.json(await this.meetingsService.respond(req.params.id as string, input, actor));
    }));

    this.router.delete("/:id", requireRole("GESTAO"), asyncHandler(async (req, res) => {
      await this.meetingsService.remove(req.params.id as string);
      res.status(204).end();
    }));
  }
}
