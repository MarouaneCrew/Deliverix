import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { PrismaService } from '../prisma/prisma.service';
import * as bcrypt from 'bcryptjs';
import { Prisma } from '../generated/prisma/client';

/**
 * Users service - manages company-scoped staff user accounts.
 * Staff users are DISPATCHER users who need accounts but don't have profiles.
 * Drivers and merchants are created via their respective modules.
 */
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Creates a new staff user account within the specified company.
   * Email must be globally unique. Hub must belong to the company.
   * Currently only DISPATCHER role is assignable via this endpoint.
   * @param companyId - Company ID (tenant scoping per R11)
   * @param dto - User data (email, password, role, hubId)
   * @returns Created user with id, email, role, isActive, hubId
   * @throws ConflictException if email already exists
   * @throws NotFoundException if hub not found in this company
   */
  async create(companyId: string, dto: CreateUserDto) {
    const existingUser = await this.prisma.user.findUnique({
      where: {
        email: dto.email,
      },
    });

    if (existingUser) throw new ConflictException('Email already exists');

    const hubExists = await this.prisma.hub.findFirst({
      where: { id: dto.hubId, companyId },
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
        fullName: `Test ${dto.role}`,
      },
    });

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      hubId: user.hubId,
    };
  }

  /**
   * Lists all users for the specified company.
   * @param companyId - Company ID (tenant scoping per R11)
   * @returns Array of users with id, email, role, isActive, hubId, createdAt
   */
  async findAll(companyId: string) {
    return this.prisma.user.findMany({
      where: { companyId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        hubId: true,
        createdAt: true,
      },
    });
  }

  /**
   * Retrieves a specific user by ID within the company scope.
   * Cross-tenant access returns 404 (not 403).
   * @param companyId - Company ID (tenant scoping per R11)
   * @param id - User ID
   * @returns User with id, email, role, isActive, hubId, createdAt
   * @throws NotFoundException if user not found in this company
   */
  async findOne(companyId: string, id: string) {
    const user = await this.prisma.user.findFirst({
      where: { id, companyId },
      select: {
        id: true,
        email: true,
        role: true,
        isActive: true,
        hubId: true,
        createdAt: true,
      },
    });

    if (!user) throw new NotFoundException('User not found');

    return user;
  }

  /**
   * Updates a user's details within the company scope.
   * Email and isActive can always be updated.
   * Password can be updated (re-hashed with bcrypt).
   * hubId can only be updated for DISPATCHER users, and must belong to the company.
   * @param companyId - Company ID (tenant scoping per R11)
   * @param id - User ID to update
   * @param dto - Updated user data (email, password, isActive, hubId optional)
   * @returns Updated user with id, email, role, isActive, hubId, createdAt
   * @throws NotFoundException if user not found or hub not found
   * @throws BadRequestException if hubId provided for non-DISPATCHER user
   * @throws ConflictException if email conflicts with another user
   */
  async update(companyId: string, id: string, dto: UpdateUserDto) {
    const data: Prisma.UserUpdateInput = {
      email: dto.email,
      isActive: dto.isActive,
    };

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10);
    }

    if (dto.hubId !== undefined) {
      const target = await this.prisma.user.findFirst({
        where: { id, companyId },
        select: { role: true },
      });

      if (!target) throw new NotFoundException('User not found');

      if (target.role !== 'DISPATCHER')
        throw new BadRequestException('hubId only applies to dispatchers');

      const hubBelongsToCompany = await this.prisma.hub.findFirst({
        where: { id: dto.hubId, companyId },
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
          createdAt: true,
        },
      });
    } catch (error) {
      if (error instanceof Prisma.PrismaClientKnownRequestError) {
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

  /**
   * Soft-deletes a user within the company scope.
   * Sets isActive=false and deletedAt=now. This immediately invalidates
   * any existing access tokens ( JwtStrategy validates on every request).
   * @param companyId - Company ID (tenant scoping per R11)
   * @param id - User ID to delete
   * @returns Deleted user with only id
   * @throws NotFoundException if user not found in this company
   */
  async remove(companyId: string, id: string) {
    try {
      const user = await this.prisma.user.update({
        where: { id, companyId },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
        select: {
          id: true,
        },
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
