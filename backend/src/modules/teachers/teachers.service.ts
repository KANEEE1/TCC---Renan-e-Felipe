import bcrypt from "bcryptjs";
import { HttpError } from "../../shared/http.js";
import { signPurposeToken } from "../../shared/auth.js";
import { validarCelular } from "../../shared/celular.js";
import { sendEmail } from "../../shared/email.js";
import { dominioRecebeEmail } from "../../shared/email-domain.js";
import type { CreateTeacherInput, UpdateTeacherInput } from "./teachers.schemas.js";
import type { TeachersRepository } from "./teachers.repository.js";

const CONFIRM_EMAIL_PURPOSE = "confirm-email";

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

    const celular = validarCelular(input.celular);

    if (!(await dominioRecebeEmail(input.email))) {
      throw new HttpError(400, "O domínio deste e-mail não recebe mensagens. Confira se foi digitado corretamente.");
    }

    const { password, disciplinaIds, ...rest } = input;
    const passwordHash = await bcrypt.hash(password, SALT_ROUNDS);

    const teacher = await this.teachersRepository.create({
      ...rest,
      celular,
      passwordHash,
      roles: ["PROFESSOR"],
      emailConfirmado: false,
      disciplinas: disciplinaIds ? { connect: disciplinaIds.map((id) => ({ id })) } : undefined
    });

    await this.sendConfirmationEmail(teacher.id, teacher.email, teacher.name);

    return teacher;
  }

  private async sendConfirmationEmail(userId: string, email: string, name: string) {
    const token = signPurposeToken(CONFIRM_EMAIL_PURPOSE, userId, "7d");
    const link = `${process.env.FRONTEND_URL}/confirmar-email?token=${token}`;

    await sendEmail(
      email,
      "Confirme seu e-mail - Cursinho Popular",
      `<p>Olá, ${name}.</p><p>Sua conta de professor foi criada. Confirme seu e-mail clicando no link abaixo:</p><p><a href="${link}">${link}</a></p><p>Esse link expira em 7 dias.</p>`
    );
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
