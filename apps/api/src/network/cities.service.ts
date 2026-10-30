import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { PrismaService } from '../prisma/prisma.service';

@Injectable()
export class CitiesService {
  constructor(private readonly prisma: PrismaService) {}

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
