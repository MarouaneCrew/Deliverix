import { Injectable } from "@nestjs/common"
import { PrismaService } from "@/prisma/prisma.service"
import type { IHubRepository } from "@/common/repositories/interfaces/hub.repository.interface"
import type { Hub } from "@/generated/prisma/client"

@Injectable()
export class HubRepository implements IHubRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByCompany(companyId: string): Promise<Hub[]> {
    return this.prisma.hub.findMany({
      where: {
        companyId,
        deletedAt: null,
      },
      include: {
        city: true,
      },
    })
  }

  async findActiveByCompany(companyId: string): Promise<Hub[]> {
    return this.prisma.hub.findMany({
      where: {
        companyId,
        isActive: true,
        deletedAt: null,
      },
      include: {
        city: true,
      },
    })
  }

  async findOne(companyId: string, id: string): Promise<Hub | null> {
    return this.prisma.hub.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
      include: {
        city: true,
      },
    })
  }

  async findByCompanyAndName(companyId: string, name: string): Promise<Hub | null> {
    return this.prisma.hub.findFirst({
      where: {
        companyId,
        name,
        deletedAt: null,
      },
    })
  }

  async create(data: {
    companyId: string
    cityId: string
    name: string
    address?: string | null
  }): Promise<Hub> {
    return this.prisma.hub.create({
      data: {
        companyId: data.companyId,
        cityId: data.cityId,
        name: data.name,
        address: data.address,
      },
      include: {
        city: true,
      },
    })
  }

  async update(companyId: string, id: string, data: Partial<Hub>): Promise<Hub> {
    return this.prisma.hub.update({
      where: {
        id,
        companyId,
      },
      data,
      include: {
        city: true,
      },
    })
  }

  async delete(companyId: string, id: string): Promise<void> {
    await this.prisma.hub.update({
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
