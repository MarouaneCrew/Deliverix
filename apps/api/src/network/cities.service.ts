import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { PrismaService } from '../prisma/prisma.service';

/**
 * Cities service - manages shared reference data for cities.
 * Cities are global (NOT tenant-owned); no companyId filtering applies.
 * Used for lookups in network operations (hubs, merchants, parcels).
 */
@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new city in the global reference data.
   * Enforces case-insensitive unique constraint on city names.
   * @param dto - City name to create
   * @returns Created city with id and name
   * @throws ConflictException if city with same name (case-insensitive) already exists
   */
  async create(dto: CreateCityDto) {
    const existingCity = await this.prisma.city.findFirst({
      where: {
        name: { equals: dto.name, mode: 'insensitive' },
      },
    });

    if (existingCity) {
      throw new ConflictException('City already exists');
    }

    const city = await this.prisma.city.create({
      data: {
        name: dto.name,
      },
      select: {
        id: true,
        name: true,
      },
    });

    return city;
  }

  /**
   * Lists all cities in the system, ordered alphabetically by name.
   * No tenant scoping - returns all cities globally.
   * @returns Array of cities with id and name
   */
  async findAll() {
    return this.prisma.city.findMany({
      orderBy: {
        name: 'asc',
      },
      select: {
        id: true,
        name: true,
      },
    });
  }

  /**
   * Retrieves a specific city by its ID.
   * @param id - City ID (cuid)
   * @returns City with id and name
   * @throws NotFoundException if city not found
   */
  async findOne(id: string) {
    const city = await this.prisma.city.findUnique({
      where: { id },
      select: {
        id: true,
        name: true,
      },
    });

    if (!city) {
      throw new NotFoundException('City not found');
    }

    return city;
  }

  /**
   * Updates a city's name.
   * Validates that the new name doesn't conflict with other cities (case-insensitive).
   * @param id - City ID to update
   * @param dto - New name (optional)
   * @returns Updated city with id and name
   * @throws NotFoundException if city not found
   * @throws ConflictException if new name conflicts with another city
   */
  async update(id: string, dto: UpdateCityDto) {
    const existingCity = await this.prisma.city.findUnique({
      where: { id },
    });

    if (!existingCity) {
      throw new NotFoundException('City not found');
    }

    if (dto.name) {
      const duplicateCity = await this.prisma.city.findFirst({
        where: {
          id: { not: id },
          name: { equals: dto.name, mode: 'insensitive' },
        },
      });

      if (duplicateCity) {
        throw new ConflictException('City already exists');
      }

      await this.prisma.city.update({
        where: { id },
        data: { name: dto.name },
        select: {
          id: true,
          name: true,
        },
      });
    }

    return {
      id: existingCity.id,
      name: dto.name ?? existingCity.name,
    };
  }
}
