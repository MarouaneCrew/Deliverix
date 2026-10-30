import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateHubDto } from './dto/create-hub.dto';
import { UpdateHubDto } from './dto/update-hub.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class HubsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(companyId: string, dto: CreateHubDto) {
    const city = await this.prisma.city.findUnique({
      where: { id: dto.cityId },
    });

    if (!city) {
      throw new NotFoundException('City not found');
    }

    try {
      const hub = await this.prisma.hub.create({
        data: {
          companyId,
          cityId: dto.cityId,
          name: dto.name,
          address: dto.address ?? null,
        },
        select: {
          id: true,
          name: true,
          address: true,
          isActive: true,
          cityId: true,
          city: {
            select: {
              id: true,
              name: true,
            },
          },
          createdAt: true,
        },
      });

      return hub;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('Hub already exists');
      }
      throw error;
    }
  }

  async findAll(companyId: string) {
    return this.prisma.hub.findMany({
      where: { companyId },
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
        address: true,
        isActive: true,
        cityId: true,
        city: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
      },
    });
  }

  async findOne(companyId: string, id: string) {
    const hub = await this.prisma.hub.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        name: true,
        address: true,
        isActive: true,
        cityId: true,
        city: {
          select: {
            id: true,
            name: true,
          },
        },
        createdAt: true,
      },
    });

    if (!hub) {
      throw new NotFoundException('Hub not found');
    }

    return hub;
  }

  async update(companyId: string, id: string, dto: UpdateHubDto) {
    const existingHub = await this.prisma.hub.findFirst({
      where: { id, companyId },
    });

    if (!existingHub) {
      throw new NotFoundException('Hub not found');
    }

    const data: Record<string, unknown> = {};

    if (dto.name !== undefined) {
      data.name = dto.name;
    }

    if (dto.address !== undefined) {
      data.address = dto.address;
    }

    if (dto.isActive !== undefined) {
      data.isActive = dto.isActive;
    }

    try {
      const hub = await this.prisma.hub.update({
        where: { id, companyId },
        data,
        select: {
          id: true,
          name: true,
          address: true,
          isActive: true,
          cityId: true,
          city: {
            select: {
              id: true,
              name: true,
            },
          },
          createdAt: true,
        },
      });

      return hub;
    } catch (error: unknown) {
      if (
        error &&
        typeof error === 'object' &&
        'code' in error &&
        (error as { code: string }).code === 'P2002'
      ) {
        throw new ConflictException('Hub already exists');
      }
      throw error;
    }
  }
}
