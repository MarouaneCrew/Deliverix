import { Injectable } from "@nestjs/common"
import type { PrismaService } from "@/prisma/prisma.service"
import type { IUserRepository } from "@/common/repositories/interfaces/user.repository.interface"
import { type User, UserRole } from "@/generated/prisma/client"

@Injectable()
export class UserRepository implements IUserRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByCompany(companyId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        companyId,
        deletedAt: null,
      },
      orderBy: {
        createdAt: "asc",
      },
    })
  }

  async findDispatchersByHub(companyId: string, hubId: string): Promise<User[]> {
    return this.prisma.user.findMany({
      where: {
        companyId,
        hubId,
        role: UserRole.DISPATCHER,
        deletedAt: null,
      },
    })
  }

  async findOne(companyId: string, id: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
    })
  }

  async findByEmail(email: string): Promise<User | null> {
    return this.prisma.user.findUnique({
      where: {
        email,
      },
    })
  }

  async findByPhone(phone: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        phone,
        deletedAt: null,
      },
    })
  }

  async create(data: {
    email: string
    passwordHash: string
    fullName: string
    phone?: string
    role: UserRole
    companyId: string
    hubId?: string | null
  }): Promise<User> {
    return this.prisma.user.create({
      data: {
        email: data.email,
        passwordHash: data.passwordHash,
        fullName: data.fullName,
        phone: data.phone,
        role: data.role,
        companyId: data.companyId,
        hubId: data.hubId,
      },
    })
  }

  async update(companyId: string, id: string, data: Partial<User>): Promise<User> {
    return this.prisma.user.update({
      where: {
        id,
        companyId,
      },
      data,
    })
  }

  async delete(companyId: string, id: string): Promise<void> {
    await this.prisma.user.update({
      where: {
        id,
        companyId,
      },
      data: {
        isActive: false,
        deletedAt: new Date(),
      },
    })
  }

  async updateAuthenticationTokens(
    userId: string,
    tokenData: {
      refreshTokenHash?: string | null
      refreshTokenExpiresAt?: Date | null
      resetTokenHash?: string | null
      resetTokenExpiresAt?: Date | null
    },
  ): Promise<User> {
    return this.prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        refreshTokenHash: tokenData.refreshTokenHash,
        refreshTokenExpiresAt: tokenData.refreshTokenExpiresAt,
        resetTokenHash: tokenData.resetTokenHash,
        resetTokenExpiresAt: tokenData.resetTokenExpiresAt,
      },
    })
  }

  async findByRefreshTokenHash(refreshTokenHash: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        refreshTokenHash,
        isActive: true,
        deletedAt: null,
      },
    })
  }

  async findByResetTokenHash(resetTokenHash: string): Promise<User | null> {
    return this.prisma.user.findFirst({
      where: {
        resetTokenHash,
        isActive: true,
        deletedAt: null,
      },
    })
  }
}
