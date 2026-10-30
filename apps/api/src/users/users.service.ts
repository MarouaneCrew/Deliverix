import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from "@nestjs/common"
import type { CreateUserDto } from "./dto/create-user.dto"
import type { UpdateUserDto } from "./dto/update-user.dto"
import type { UserRepository } from "../common/repositories/impl/user.repository"
import * as bcrypt from "bcryptjs"
import type { User, UserRole } from "@generated/prisma/client"

/**
 * Users service - manages company-scoped staff user accounts.
 * Staff users are DISPATCHER users who need accounts but don't have profiles.
 * Drivers and merchants are created via their respective modules.
 */
@Injectable()
export class UsersService {
  constructor(private readonly userRepository: UserRepository) {}

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
    const existingUser = await this.userRepository.findByEmail(dto.email)

    if (existingUser) throw new ConflictException("Email already exists")

    const hub = await this.userRepository.findOne(companyId, dto.hubId)

    if (!hub) throw new NotFoundException("Hub not found")

    const passwordHash = await bcrypt.hash(dto.password, 10)

    const user = await this.userRepository.create({
      email: dto.email,
      passwordHash,
      role: dto.role,
      hubId: dto.hubId,
      companyId,
      fullName: `Test ${dto.role}`,
    })

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      hubId: user.hubId,
    }
  }

  /**
   * Lists all users for the specified company.
   * @param companyId - Company ID (tenant scoping per R11)
   * @returns Array of users with id, email, role, isActive, hubId, createdAt
   */
  async findAll(companyId: string) {
    const users = await this.userRepository.findAllByCompany(companyId)

    return users.map(u => ({
      id: u.id,
      email: u.email,
      role: u.role,
      isActive: u.isActive,
      hubId: u.hubId,
      createdAt: u.createdAt,
    }))
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
    const user = await this.userRepository.findOne(companyId, id)

    if (!user) throw new NotFoundException("User not found")

    return {
      id: user.id,
      email: user.email,
      role: user.role,
      isActive: user.isActive,
      hubId: user.hubId,
      createdAt: user.createdAt,
    }
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
    const target = await this.userRepository.findOne(companyId, id)

    if (!target) throw new NotFoundException("User not found")

    const data: Partial<User> = {
      email: dto.email,
      isActive: dto.isActive,
    }

    if (dto.password) {
      data.passwordHash = await bcrypt.hash(dto.password, 10)
    }

    if (dto.hubId !== undefined) {
      if (target.role !== "DISPATCHER")
        throw new BadRequestException("hubId only applies to dispatchers")

      const hubExists = await this.userRepository.findOne(companyId, dto.hubId)
      if (!hubExists) throw new NotFoundException("Hub not found")

      data.hubId = dto.hubId
    }

    try {
      const user = await this.userRepository.update(companyId, id, data)

      return {
        id: user.id,
        email: user.email,
        role: user.role,
        isActive: user.isActive,
        hubId: user.hubId,
        createdAt: user.createdAt,
      }
    } catch (error: unknown) {
      if (error instanceof Error) {
        // Check for unique constraint violation
        if ("code" in error && (error as { code: string }).code === "P2002") {
          throw new ConflictException("Email already exists")
        }
      }
      throw error
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
      await this.userRepository.update(companyId, id, {
        isActive: false,
        deletedAt: new Date(),
      })

      const user = await this.userRepository.findOne(companyId, id)

      if (!user) throw new NotFoundException("User not found")

      return { id: user.id }
    } catch (error: unknown) {
      if (error instanceof Error) {
        if ("code" in error && (error as { code: string }).code === "P2025") {
          throw new NotFoundException("User not found")
        }
      }
      throw error
    }
  }
}
