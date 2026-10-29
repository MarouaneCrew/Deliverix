import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '../generated/prisma/client';

@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) { }

  async create(companyId: string, dto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: dto.email
      }
    });

    if (existingUser) throw new ConflictException('Email already exists');

    const hubExists = await this.prisma.hub.findFirst({
      where: { id: dto.hubId, companyId }
    });

    if (!hubExists) throw new NotFoundException('Hub not found');

    const passwordHash = await bcrypt.hash(dto.password, 10);

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        passwordHash,
        role: dto.role,
        hubId: dto.hubId,
        companyId,
        fullName: `Test ${dto.role}`
      }
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      hubId: user.hubId
    };
  }

  async findAll(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        hubId: true,
        createdAt: true
      }
    });
  }

  async findOne(companyId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        hubId: true,
        createdAt: true
      }
    });

    if (!user) throw new NotFoundException('User not found');

    return user;
  }

  async update(companyId: string, id: string, dto: UpdateUserDto) {
    const data: Prisma.UserUpdateInput = {
      email: dto.email,
      isActive: dto.isActive
    };

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (dto.hubId !== undefined) {
      const target = await this.prisma.user.findFirst({
        where: { id, companyId },
        select: { role: true }
      });

      if (!target) throw new NotFoundException('User not found');

      if (target.role !== 'DISPATCHER') throw new BadRequestException('hubId only applies to dispatchers');

      const hubBelongsToCompany = await this.prisma.hub.findFirst({
        where: { id: dto.hubId, companyId }
      });

      if (!hubBelongsToCompany) throw new NotFoundException('Hub not found');

      data.hub = { connect: { id: dto.hubId } };
    }

    try {
      return await this.prisma.user.update({
        where: { id, companyId },
        data,
        select: {
          id: true,
          email: true,
          role: true,
          isActive: true,
          hubId: true,
          createdAt: true
        }
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError
      ) {
        if (error.code === 'P2025') {
          throw new NotFoundException('User not found');
        }

        if (error.code === 'P2002') {
          throw new ConflictException('Email already exists');
        }
      }

      throw error;
    }
  }

  async remove(companyId: string, id: string) {
    try {
      const user = await this.prisma.user.update({
        where: { id, companyId },
        data: {
          isActive: false,
          deletedAt: new Date()
        },
        select: {
          id: true
        }
      });

      return user;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2025'
      ) {
        throw new NotFoundException('User not found');
      }

      throw error;
    }
  }
}