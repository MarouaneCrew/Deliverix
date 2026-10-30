import { Injectable } from "@nestjs/common"
import type { PrismaService } from "@prisma/prisma.service"
import type { ICompanyRepository } from "../interfaces/company.repository.interface"
import type { Company } from "@generated/prisma/client"

@Injectable()
export class CompanyRepository implements ICompanyRepository {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(): Promise<Company[]> {
    return this.prisma.company.findMany({
      where: {
        deletedAt: null,
      },
    })
  }

  async findOne(id: string): Promise<Company | null> {
    return this.prisma.company.findFirst({
      where: {
        id,
        deletedAt: null,
      },
    })
  }

  async create(data: { name: string }): Promise<Company> {
    return this.prisma.company.create({
      data: {
        name: data.name,
      },
    })
  }

  async update(id: string, data: Partial<Company>): Promise<Company> {
    return this.prisma.company.update({
      where: {
        id,
      },
      data,
    })
  }

  async delete(id: string): Promise<void> {
    await this.prisma.company.update({
      where: {
        id,
      },
      data: {
        deletedAt: new Date(),
      },
    })
  }

  async findByName(name: string): Promise<Company | null> {
    return this.prisma.company.findFirst({
      where: {
        name,
        deletedAt: null,
      },
    })
  }
}
