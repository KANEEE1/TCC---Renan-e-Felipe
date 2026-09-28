import { HttpError } from "../../shared/http.js";
import type { CreateMeetingInput, UpdateMeetingInput } from "./meetings.schemas.js";
import type { MeetingsRepository } from "./meetings.repository.js";

export class MeetingsService {
  constructor(private readonly meetingsRepository: MeetingsRepository) {}

  list() {
    return this.meetingsRepository.list();
  }

  async getById(id: string) {
    const meeting = await this.meetingsRepository.findById(id);

    if (!meeting) {
      throw new HttpError(404, "Meeting not found");
    }

    return meeting;
  }

  create(input: CreateMeetingInput) {
    if (input.horarioFim <= input.horarioInicio) {
      throw new HttpError(400, "Meeting end time must be after start time");
    }

    return this.meetingsRepository.create(input);
  }

  async update(id: string, input: UpdateMeetingInput) {
    await this.getById(id);

    if (input.horarioInicio && input.horarioFim && input.horarioFim <= input.horarioInicio) {
      throw new HttpError(400, "Meeting end time must be after start time");
    }

    return this.meetingsRepository.update(id, input);
  }

  async remove(id: string) {
    await this.getById(id);
    await this.meetingsRepository.remove(id);
  }
}
