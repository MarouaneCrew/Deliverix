import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateHubDto } from './dto/create-hub.dto';
import { UpdateHubDto } from './dto/update-hub.dto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Hubs service - manages company-scoped warehouse locations.
 * Each hub belongs to exactly one company and one city.
 * Used as assignment points for dispatchers and drivers.
 */
@Injectable()
export class HubsService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new hub within the specified company.
   * Validates that the city exists and enforces unique hub name per company.
   * @param companyId - Company ID (tenant scoping)
   * @param dto - Hub data (cityId, name, address optional)
   * @returns Created hub with city details
   * @throws NotFoundException if city not found
   * @throws ConflictException if hub with same name already exists for this company
   */
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

  /**
   * Lists all hubs for the specified company, ordered alphabetically by name.
   * @param companyId - Company ID (tenant scoping)
   * @returns Array of hubs with city details
   */
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

  /**
   * Retrieves a specific hub by ID within the company scope.
   * Returns 404 if hub doesn't exist or belongs to another company.
   * @param companyId - Company ID (tenant scoping)
   * @param id - Hub ID
   * @returns Hub with city details
   * @throws NotFoundException if hub not found in this company
   */
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

  /**
   * Updates a hub's details.
   * Validates that the hub belongs to the company and checks for name conflicts.
   * @param companyId - Company ID (tenant scoping)
   * @param id - Hub ID to update
   * @param dto - Updated hub data (name, address, isActive optional)
   * @returns Updated hub with city details
   * @throws NotFoundException if hub not found in this company
   * @throws ConflictException if new name conflicts with another hub in the same company
   */
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
