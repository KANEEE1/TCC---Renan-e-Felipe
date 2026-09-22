import bcrypt from "bcryptjs";
import { HttpError } from "../../shared/http.js";
import { signAuthToken } from "../../shared/auth.js";
import type { LoginInput } from "./auth.schemas.js";
import type { UsersRepository } from "../users/users.repository.js";

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
}
