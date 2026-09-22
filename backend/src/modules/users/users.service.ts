import bcrypt from "bcryptjs";
import { HttpError } from "../../shared/http.js";
import type { CreateUserInput } from "./users.schemas.js";
import type { UsersRepository } from "./users.repository.js";

const SALT_ROUNDS = 10;

export class UsersService {
  constructor(private readonly usersRepository: UsersRepository) {}

  list() {
    return this.usersRepository.list();
  }

  async create(input: CreateUserInput) {
    const existingUser = await this.usersRepository.findByEmail(input.email);

    if (existingUser) {
      throw new HttpError(409, "Email already registered");
    }

    const { password, ...rest } = input;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    return this.usersRepository.create({ ...rest, passwordHash });
  }
}
