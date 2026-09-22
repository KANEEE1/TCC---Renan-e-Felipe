import type { Prisma, PrismaClient } from "@prisma/client";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  celular: true,
  roles: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

export class UsersRepository {
  constructor(private readonly prisma: PrismaClient) {}

  list() {
    return this.prisma.user.findMany({
      orderBy: { name: "asc" },
      select: publicUserSelect
    });
  }

  findByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: publicUserSelect
    });
  }

  findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      select: publicUserSelect
    });
  }

  findAuthByEmail(email: string) {
    return this.prisma.user.findUnique({
      where: { email },
      select: { id: true, email: true, roles: true, passwordHash: true }
    });
  }

  create(data: Prisma.UserCreateInput) {
    return this.prisma.user.create({
      data,
      select: publicUserSelect
    });
  }
}
