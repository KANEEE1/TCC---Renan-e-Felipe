import { Router } from "express";
import { asyncHandler } from "../../shared/http.js";
import { createMeetingSchema, updateMeetingSchema } from "./meetings.schemas.js";
import type { MeetingsService } from "./meetings.service.js";

export class MeetingsController {
  readonly router = Router();

  constructor(private readonly meetingsService: MeetingsService) {
    this.router.get("/", asyncHandler(async (_req, res) => {
      res.json(await this.meetingsService.list());
    }));

    this.router.get("/:id", asyncHandler(async (req, res) => {
      res.json(await this.meetingsService.getById(req.params.id as string));
    }));

    this.router.post("/", asyncHandler(async (req, res) => {
      const input = createMeetingSchema.parse(req.body);
      res.status(201).json(await this.meetingsService.create(input));
    }));

    this.router.put("/:id", asyncHandler(async (req, res) => {
      const input = updateMeetingSchema.parse(req.body);
      res.json(await this.meetingsService.update(req.params.id as string, input));
    }));

    this.router.delete("/:id", asyncHandler(async (req, res) => {
      await this.meetingsService.remove(req.params.id as string);
      res.status(204).end();
    }));
  }
}
