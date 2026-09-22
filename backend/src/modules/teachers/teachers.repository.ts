import type { Prisma, PrismaClient } from "@prisma/client";

const teacherSelect = {
  id: true,
  name: true,
  email: true,
  celular: true,
  roles: true,
  ativo: true,
  disciplinas: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

export class TeachersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.user.findMany({
      where: { roles: { has: "PROFESSOR" } },
      orderBy: { name: "asc" },
      select: teacherSelect
    });
  }

  findById(id: string) {
    return this.prisma.user.findFirst({
      where: { id, roles: { has: "PROFESSOR" } },
      select: teacherSelect
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({ where: { email } });
  }

  create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({ data, select: teacherSelect });
  }

  update(id: string, data: Prisma.UserUpdateInput) {
    return this.prisma.user.update({ where: { id }, data, select: teacherSelect });
  }
}
