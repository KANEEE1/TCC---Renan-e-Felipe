import bcrypt from "bcryptjs";
import type { Role } from "@prisma/client";
import { HttpError } from "../../shared/http.js";
import { signAuthToken } from "../../shared/auth.js";
import type { ChangePasswordInput, LoginInput, SetupInput, UpdateMeInput } from "./auth.schemas.js";
import type { UsersRepository } from "../users/users.repository.js";

const SALT_ROUNDS = 10;

export class AuthService {
  constructor(private readonly usersRepository: UsersRepository) {}

  async login(input: LoginInput) {
    const user = await this.verifyCredentials(input.email, input.password);

    return this.session(user);
  }

  // Troca de senha sem estar logado: exige e-mail e senha atual, com as mesmas regras do login.
  async changePassword(input: ChangePasswordInput) {
    const user = await this.verifyCredentials(input.email, input.senhaAtual);
    const passwordHash = await bcrypt.hash(input.novaSenha, SALT_ROUNDS);

    await this.usersRepository.update(user.id, { passwordHash });
  }

  private async verifyCredentials(email: string, password: string) {
    const user = await this.usersRepository.findAuthByEmail(email);

    if (!user) {
      throw new HttpError(401, "Invalid credentials");
    }

    const passwordMatches = await bcrypt.compare(password, user.passwordHash);

    if (!passwordMatches) {
      throw new HttpError(401, "Invalid credentials");
    }

    // Só depois da senha conferida, para não revelar quais e-mails existem.
    if (!user.ativo) {
      throw new HttpError(403, "Seu acesso foi desativado. Procure a coordenação.");
    }

    return user;
  }

  async setupStatus() {
    return { disponivel: (await this.usersRepository.countGestores()) === 0 };
  }

  async setup(input: SetupInput) {
    const { password, ...rest } = input;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const user = await this.usersRepository.transaction(async (repository) => {
      if ((await repository.countGestores()) > 0) {
        throw new HttpError(409, "Management account already exists");
      }

      return repository.create({ ...rest, passwordHash, roles: ["GESTAO"] });
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
