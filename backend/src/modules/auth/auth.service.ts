import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { HttpError } from "../../shared/http.js";
import { signAuthToken } from "../../shared/auth.js";
import type { LoginInput, SetupInput, UpdateMeInput } from "./auth.schemas.js";
import type { UsersRepository } from "../users/users.repository.js";

const SALT_ROUNDS = 10;

export class AuthService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async login(input: LoginInput) {
    const user = await this.usersRepository.findAuthByEmail(input.email);

    if (!user) {
      throw new HttpError(401, "Invalid credentials");
    }

    const passwordMatches = await bcrypt.compare(input.password, user.passwordHash);

    if (!passwordMatches) {
      throw new HttpError(401, "Invalid credentials");
    }

    return this.session(user);
  }

  async setupStatus() {
    return { disponivel: (await this.usersRepository.countGestores()) === 0 };
  }

  async setup(input: SetupInput) {
    const { password, tambemProfessor, ...rest } = input;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await this.usersRepository.transaction(async (repository) => {
      if ((await repository.countGestores()) > 0) {
        throw new HttpError(409, "Management account already exists");
      }

      return repository.create({ ...rest, passwordHash, roles: tambemProfessor ? ["GESTAO", "PROFESSOR"] : ["GESTAO"] });
    });

    return this.session(user);
  }

  private session(user: { id: string; email: string; roles: Role[] }) {
    const token = signAuthToken({ sub: user.id, roles: user.roles });

    return { token, user: { id: user.id, email: user.email, roles: user.roles } };
  }

  async me(userId: string) {
    const user = await this.usersRepository.findById(userId);

    if (!user) {
      throw new HttpError(404, "User not found");
    }

    return user;
  }

  async updateMe(userId: string, input: UpdateMeInput) {
    await this.me(userId);
    return this.usersRepository.update(userId, input);
  }
}
