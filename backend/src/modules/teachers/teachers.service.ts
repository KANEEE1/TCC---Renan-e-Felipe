import bcrypt from "bcryptjs";
import { HttpError } from "../../shared/http.js";
import type { CreateTeacherInput, UpdateTeacherInput } from "./teachers.schemas.js";
import type { TeachersRepository } from "./teachers.repository.js";

const SALT_ROUNDS = 10;

export class TeachersService {
  constructor(private readonly teachersRepository: TeachersRepository) {}

  list() {
    return this.teachersRepository.list();
  }

  async getById(id: string) {
    const teacher = await this.teachersRepository.findById(id);

    if (!teacher) {
      throw new HttpError(404, "Teacher not found");
    }

    return teacher;
  }

  async create(input: CreateTeacherInput) {
    const existing = await this.teachersRepository.findByEmail(input.email);

    if (existing) {
      throw new HttpError(409, "Email already registered");
    }

    const { password, disciplinaIds, ...rest } = input;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    return this.teachersRepository.create({
      ...rest,
      passwordHash,
      roles: ["PROFESSOR"],
      disciplinas: disciplinaIds ? { connect: disciplinaIds.map((id) => ({ id })) } : undefined
    });
  }

  async update(id: string, input: UpdateTeacherInput) {
    await this.getById(id);

    const { disciplinaIds, ...rest } = input;

    return this.teachersRepository.update(id, {
      ...rest,
      disciplinas: disciplinaIds ? { set: disciplinaIds.map((id) => ({ id })) } : undefined
    });
  }
}
