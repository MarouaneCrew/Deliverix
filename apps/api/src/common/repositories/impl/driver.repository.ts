import { Injectable } from "@nestjs/common"
import type { PrismaService } from "@/prisma/prisma.service"
import type { IDriverRepository } from "@/common/repositories/interfaces/driver.repository.interface"
import { type Driver, type DriverEngagement, DriverStatus } from "@/generated/prisma/client"

@Injectable()
export class DriverRepository implements IDriverRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByCompany(companyId: string): Promise<Driver[]> {
    return this.prisma.driver.findMany({
      where: {
        user: {
          companyId,
        },
      },
      include: {
        user: true,
        homeHub: true,
      },
    })
  }

  async findAllByHub(hubId: string): Promise<Driver[]> {
    return this.prisma.driver.findMany({
      where: {
        homeHubId: hubId,
      },
      include: {
        user: true,
        homeHub: true,
      },
    })
  }

  async findAvailableByHub(hubId: string): Promise<Driver[]> {
    return this.prisma.driver.findMany({
      where: {
        homeHubId: hubId,
        status: DriverStatus.AVAILABLE,
      },
      include: {
        user: true,
        homeHub: true,
      },
    })
  }

  async findByUserId(userId: string): Promise<Driver | null> {
    return this.prisma.driver.findUnique({
      where: {
        userId,
      },
      include: {
        user: true,
        homeHub: true,
      },
    })
  }

  async findOne(id: string): Promise<Driver | null> {
    return this.prisma.driver.findUnique({
      where: {
        id,
      },
      include: {
        user: true,
        homeHub: true,
      },
    })
  }

  async create(data: {
    userId: string
    homeHubId: string
    engagement?: DriverEngagement
    status?: DriverStatus
  }): Promise<Driver> {
    return this.prisma.driver.create({
      data: {
        userId: data.userId,
        homeHubId: data.homeHubId,
        engagement: data.engagement,
        status: data.status,
      },
      include: {
        user: true,
        homeHub: true,
      },
    })
  }

  async update(id: string, data: Partial<Driver>): Promise<Driver> {
    return this.prisma.driver.update({
      where: {
        id,
      },
      data,
      include: {
        user: true,
        homeHub: true,
      },
    })
  }

  async updateStatus(id: string, status: DriverStatus): Promise<Driver> {
    return this.prisma.driver.update({
      where: {
        id,
      },
      data: {
        status,
      },
      include: {
        user: true,
        homeHub: true,
      },
    })
  }

  async updateHomeHub(id: string, homeHubId: string): Promise<Driver> {
    return this.prisma.driver.update({
      where: {
        id,
      },
      data: {
        homeHubId,
      },
      include: {
        user: true,
        homeHub: true,
      },
    })
  }
}
