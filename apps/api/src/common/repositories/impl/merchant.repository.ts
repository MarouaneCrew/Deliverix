import { Injectable } from "@nestjs/common"
import type { PrismaService } from "@/prisma/prisma.service"
import type {
  IMerchantRepository,
  MerchantWithCityAndUser,
} from "@/common/repositories/interfaces/merchant.repository.interface"
import type { Merchant } from "@/generated/prisma/client"

@Injectable()
export class MerchantRepository implements IMerchantRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByCompany(companyId: string): Promise<MerchantWithCityAndUser[]> {
    return (await this.prisma.merchant.findMany({
      where: {
        companyId,
        deletedAt: null,
      },
      include: {
        city: true,
        user: true,
      },
    })) as MerchantWithCityAndUser[]
  }

  async findActiveByCompany(companyId: string): Promise<MerchantWithCityAndUser[]> {
    return (await this.prisma.merchant.findMany({
      where: {
        companyId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        city: true,
        user: true,
      },
    })) as MerchantWithCityAndUser[]
  }

  async findOne(companyId: string, id: string): Promise<MerchantWithCityAndUser | null> {
    return (await this.prisma.merchant.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
      include: {
        city: true,
        user: true,
      },
    })) as MerchantWithCityAndUser | null
  }

  async findByUserId(userId: string): Promise<MerchantWithCityAndUser | null> {
    return (await this.prisma.merchant.findFirst({
      where: {
        userId,
        deletedAt: null,
      },
      include: {
        city: true,
        user: true,
      },
    })) as MerchantWithCityAndUser | null
  }

  async findByPhone(phone: string): Promise<MerchantWithCityAndUser | null> {
    return (await this.prisma.merchant.findFirst({
      where: {
        phone,
        deletedAt: null,
      },
      include: {
        city: true,
        user: true,
      },
    })) as MerchantWithCityAndUser | null
  }

  async create(data: {
    companyId: string
    userId?: string | null
    cityId: string
    name: string
    phone?: string
    address?: string
  }): Promise<MerchantWithCityAndUser> {
    return (await this.prisma.merchant.create({
      data: {
        companyId: data.companyId,
        userId: data.userId,
        cityId: data.cityId,
        name: data.name,
        phone: data.phone,
        address: data.address,
      },
      include: {
        city: true,
        user: true,
      },
    })) as MerchantWithCityAndUser
  }

  async update(
    companyId: string,
    id: string,
    data: Partial<Merchant>,
  ): Promise<MerchantWithCityAndUser> {
    return (await this.prisma.merchant.update({
      where: {
        id,
        companyId,
      },
      data,
      include: {
        city: true,
        user: true,
      },
    })) as MerchantWithCityAndUser
  }

  async linkUser(companyId: string, id: string, userId: string): Promise<MerchantWithCityAndUser> {
    return (await this.prisma.merchant.update({
      where: {
        id,
        companyId,
      },
      data: {
        userId,
      },
      include: {
        city: true,
        user: true,
      },
    })) as MerchantWithCityAndUser
  }

  async unlinkUser(companyId: string, id: string): Promise<MerchantWithCityAndUser> {
    return (await this.prisma.merchant.update({
      where: {
        id,
        companyId,
      },
      data: {
        userId: null,
      },
      include: {
        city: true,
        user: true,
      },
    })) as MerchantWithCityAndUser
  }

  async delete(companyId: string, id: string): Promise<void> {
    await this.prisma.merchant.update({
      where: {
        id,
        companyId,
      },
      data: {
        deletedAt: new Date(),
      },
    })
  }
}
