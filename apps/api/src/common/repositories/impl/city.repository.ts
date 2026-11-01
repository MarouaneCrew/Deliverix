import { Injectable } from "@nestjs/common"
import { PrismaService } from "@/prisma/prisma.service"
import type { ICityRepository } from "@/common/repositories/interfaces/city.repository.interface"
import type { City } from "@/generated/prisma/client"

@Injectable()
export class CityRepository implements ICityRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<City[]> {
    return this.prisma.city.findMany({
      where: {
        deletedAt: null,
      },
    })
  }

  async findOne(id: string): Promise<City | null> {
    return this.prisma.city.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    })
  }

  async findByName(name: string): Promise<City | null> {
    return this.prisma.city.findFirst({
      where: {
        name: {
          equals: name,
          mode: "insensitive",
        },
        deletedAt: null,
      },
    })
  }

  async create(data: { name: string }): Promise<City> {
    return this.prisma.city.create({
      data: {
        name: data.name,
      },
    })
  }

  async update(id: string, data: Partial<City>): Promise<City> {
    return this.prisma.city.update({
      where: {
        id,
      },
      data,
    })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.city.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    })
  }
}
