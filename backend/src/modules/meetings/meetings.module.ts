import { prisma } from "../../shared/prisma.js";
import { MeetingsController } from "./meetings.controller.js";
import { MeetingsRepository } from "./meetings.repository.js";
import { MeetingsService } from "./meetings.service.js";

export const meetingsRepository = new MeetingsRepository(prisma);
export const meetingsService = new MeetingsService(meetingsRepository);
export const meetingsController = new MeetingsController(meetingsService);
