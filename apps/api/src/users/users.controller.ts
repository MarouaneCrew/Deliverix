/**
 * UsersController - manages company-scoped staff user accounts.
 * Staff users are DISPATCHER users who need accounts but don't have profiles.
 * Drivers and merchants are created via their respective modules.
 *
 * All operations are scoped to the authenticated user's company.
 * Cross-tenant access returns 404 (not 403).
 * ADMIN role required for all operations.
 */
import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from "@nestjs/common"
import { JwtAuthGuard } from "../auth/guards/jwt-auth.guard"
import { RolesGuard } from "../auth/guards/roles.guard"
import { UserRole } from "../generated/prisma/enums"
import { CurrentUser } from "../auth/decorators/current-user.decorator"
import { Roles } from "../auth/decorators/roles.decorator"
import type { CreateUserDto } from "./dto/create-user.dto"
import type { UpdateUserDto } from "./dto/update-user.dto"
import type { UsersService } from "./users.service"

/**
 * Creates a new staff user account within the authenticated user's company.
 * ADMIN role required. Email must be globally unique. Hub must belong to the company.
 * Currently only DISPATCHER role is assignable via this endpoint.
 * @param actor - Authenticated ADMIN user (provides companyId from token)
 * @param createUserDto - User data (email, password, role, hubId)
 * @returns Created user with id, email, role, isActive, hubId
 */
@Controller("users")
export class UsersController {
  constructor(private readonly usersService: UsersService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() actor: Express.User, @Body() createUserDto: CreateUserDto) {
    return this.usersService.create(actor.companyId, createUserDto)
  }

  /**
   * Lists all users for the authenticated user's company.
   * ADMIN role required. Returns only users belonging to the requesting user's company.
   * @param actor - Authenticated ADMIN user (provides companyId from token)
   * @returns Array of users with id, email, role, isActive, hubId, createdAt
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findAll(@CurrentUser() actor: Express.User) {
    return this.usersService.findAll(actor.companyId)
  }

  /**
   * Retrieves a specific user by ID within the authenticated user's company.
   * ADMIN role required. Cross-tenant access returns 404 (not 403).
   * @param actor - Authenticated ADMIN user (provides companyId from token)
   * @param id - User ID
   * @returns User with id, email, role, isActive, hubId, createdAt
   * @throws NotFoundException if user not found in this company
   */
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  findOne(@CurrentUser() actor: Express.User, @Param("id") id: string) {
    return this.usersService.findOne(actor.companyId, id)
  }

  /**
   * Updates a user's details within the authenticated user's company.
   * ADMIN role required. Email and isActive can always be updated.
   * Password can be updated (re-hashed with bcrypt).
   * hubId can only be updated for DISPATCHER users, and must belong to the company.
   * @param actor - Authenticated ADMIN user (provides companyId from token)
   * @param id - User ID to update
   * @param updateUserDto - Updated user data (email, password, isActive, hubId optional)
   * @returns Updated user with id, email, role, isActive, hubId, createdAt
   */
  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser() actor: Express.User,
    @Param("id") id: string,
    @Body() updateUserDto: UpdateUserDto,
  ) {
    return this.usersService.update(actor.companyId, id, updateUserDto)
  }

  /**
   * Soft-deletes a user within the authenticated user's company.
   * ADMIN role required. Sets isActive=false and deletedAt=now.
   * This immediately invalidates any existing access tokens.
   * @param actor - Authenticated ADMIN user (provides companyId from token)
   * @param id - User ID to delete
   * @returns Deleted user with only id
   */
  @Delete(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser() actor: Express.User, @Param("id") id: string) {
    return this.usersService.remove(actor.companyId, id)
  }
}
