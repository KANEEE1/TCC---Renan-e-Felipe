import { Prisma, type PrismaClient } from "@prisma/client";

const publicUserSelect = {
  id: true,
  name: true,
  email: true,
  celular: true,
  roles: true,
  ativo: true,
  departamento: true,
  bio: true,
  createdAt: true,
  updatedAt: true
} satisfies Prisma.UserSelect;

type Db = PrismaClient | Prisma.TransactionClient;

export class UsersRepository {
  constructor(
    private readonly prisma: PrismaClient,
    private readonly db: Db = prisma
  ) {}

  transaction<T>(fn: (repository: UsersRepository) => Promise<T>) {
    return this.prisma.$transaction((tx) => fn(new UsersRepository(this.prisma, tx)), {
      isolationLevel: Prisma.TransactionIsolationLevel.Serializable
    });
  }

  countGestores() {
    return this.db.user.count({ where: { roles: { has: "GESTAO" } } });
  }

  list() {
    return this.db.user.findMany({
      orderBy: { name: "asc" },
      select: publicUserSelect
    });
  }

  findByEmail(email: string) {
    return this.db.user.findUnique({
      where: { email },
      select: publicUserSelect
    });
  }

  findById(id: string) {
    return this.db.user.findUnique({
      where: { id },
      select: publicUserSelect
    });
  }

  findAuthByEmail(email: string) {
    return this.db.user.findUnique({
      where: { email },
      select: { id: true, email: true, roles: true, ativo: true, passwordHash: true }
    });
  }

  create(data: Prisma.UserCreateInput) {
    return this.db.user.create({
      data,
      select: publicUserSelect
    });
  }

  update(id: string, data: Prisma.UserUpdateInput) {
    return this.db.user.update({
      where: { id },
      data,
      select: publicUserSelect
    });
  }
}
