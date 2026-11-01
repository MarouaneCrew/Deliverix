/**
 * Hubs controller - manages company-scoped warehouse locations.
 * Hubs are tenant-owned (companyId required). Each hub belongs to one company and one city.
 * ADMIN role required for modifications; all authenticated users can list/get hubs.
 */
import { Controller, Get, Post, Body, Patch, Param, UseGuards } from "@nestjs/common"
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard"
import { RolesGuard } from "@/auth/guards/roles.guard"
import { UserRole } from "@/generated/prisma/enums"
import { Roles } from "@/auth/decorators/roles.decorator"
import { CurrentUser } from "@/auth/decorators/current-user.decorator"
import type { CreateHubDto } from "./dto/create-hub.dto"
import type { UpdateHubDto } from "./dto/update-hub.dto"
import type { HubsService } from "./hubs.service"

/**
 * Creates a new hub within the authenticated user's company.
 * ADMIN role required. Validates city exists and enforces unique hub name per company.
 * Cross-tenant access returns 404 (not 403).
 * @param actor - Authenticated user (provides companyId from token)
 * @param createHubDto - Hub data (cityId, name, address optional)
 * @returns Created hub with city details
 */
@Controller("hubs")
export class HubsController {
  constructor(private readonly hubsService: HubsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@CurrentUser() actor: Express.User, @Body() createHubDto: CreateHubDto) {
    return this.hubsService.create(actor.companyId, createHubDto)
  }

  /**
   * Lists all hubs for the authenticated user's company, ordered by name.
   * All authenticated users (ADMIN, DISPATCHER, DRIVER, MERCHANT) can view hubs.
   * Returns only hubs belonging to the requesting user's company.
   * @param actor - Authenticated user (provides companyId from token)
   * @returns Array of hubs with city details
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER, UserRole.MERCHANT)
  findAll(@CurrentUser() actor: Express.User) {
    return this.hubsService.findAll(actor.companyId)
  }

  /**
   * Retrieves a specific hub by ID within the authenticated user's company.
   * All authenticated users can view a specific hub.
   * Cross-tenant access returns 404 (not 403).
   * @param actor - Authenticated user (provides companyId from token)
   * @param id - Hub ID
   * @returns Hub with city details
   * @throws NotFoundException if hub not found in this company
   */
  @Get(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.DRIVER, UserRole.MERCHANT)
  findOne(@CurrentUser() actor: Express.User, @Param("id") id: string) {
    return this.hubsService.findOne(actor.companyId, id)
  }

  /**
   * Updates a hub's details within the authenticated user's company.
   * ADMIN role required. Validates city exists and checks for name conflicts.
   * Cross-tenant access returns 404 (not 403).
   * @param actor - Authenticated user (provides companyId from token)
   * @param id - Hub ID to update
   * @param updateHubDto - Updated hub data (name, address, isActive optional)
   * @returns Updated hub with city details
   */
  @Patch(":id")
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser() actor: Express.User,
    @Param("id") id: string,
    @Body() updateHubDto: UpdateHubDto,
  ) {
    return this.hubsService.update(actor.companyId, id, updateHubDto)
  }
}
