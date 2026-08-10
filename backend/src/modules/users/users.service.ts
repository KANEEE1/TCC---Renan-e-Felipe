import { HttpError } from "../../shared/http.js";
import type { CreateUserInput } from "./users.schemas.js";
import type { UsersRepository } from "./users.repository.js";

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

    return this.usersRepository.create(input);
  }
}
