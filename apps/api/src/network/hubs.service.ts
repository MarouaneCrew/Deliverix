import { Injectable, NotFoundException, ConflictException } from "@nestjs/common"
import type { CreateHubDto } from "./dto/create-hub.dto"
import type { UpdateHubDto } from "./dto/update-hub.dto"
import type { HubRepository } from "@/common/repositories/impl/hub.repository"
import type { Hub } from "@/generated/prisma/client"

/**
 * Hubs service - manages company-scoped warehouse locations.
 * Each hub belongs to exactly one company and one city.
 * Used as assignment points for dispatchers and drivers.
 */
@Injectable()
export class HubsService {
  constructor(private readonly hubRepository: HubRepository) {}

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
    // Check city exists
    const city = await this.hubRepository.findOne(companyId, dto.cityId)
    if (!city) {
      throw new NotFoundException("City not found")
    }

    // Check hub name doesn't already exist
    const existingHub = await this.hubRepository.findByCompanyAndName(companyId, dto.name)
    if (existingHub) {
      throw new ConflictException("Hub already exists")
    }

    const hub = await this.hubRepository.create({
      companyId,
      cityId: dto.cityId,
      name: dto.name,
      address: dto.address ?? null,
    })

    return hub
  }

  /**
   * Lists all hubs for the specified company, ordered alphabetically by name.
   * @param companyId - Company ID (tenant scoping)
   * @returns Array of hubs with city details
   */
  async findAll(companyId: string) {
    const hubs = await this.hubRepository.findAllByCompany(companyId)

    return hubs.map(h => ({
      id: h.id,
      name: h.name,
      address: h.address,
      isActive: h.isActive,
      cityId: h.cityId,
      city: (h as any).city ? { id: (h as any).city.id, name: (h as any).city.name } : null,
      createdAt: h.createdAt,
    }))
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
    const hub = await this.hubRepository.findOne(companyId, id)

    if (!hub) {
      throw new NotFoundException("Hub not found")
    }

    return hub
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
    const existingHub = await this.hubRepository.findOne(companyId, id)

    if (!existingHub) {
      throw new NotFoundException("Hub not found")
    }

    // Check name conflict if name is changing
    if (dto.name && dto.name !== existingHub.name) {
      const duplicateHub = await this.hubRepository.findByCompanyAndName(companyId, dto.name)
      if (duplicateHub && duplicateHub.id !== id) {
        throw new ConflictException("Hub already exists")
      }
    }

    const hub = await this.hubRepository.update(companyId, id, {
      name: dto.name ?? undefined,
      address: dto.address ?? undefined,
      isActive: dto.isActive,
    })

    // Add city to response
    return {
      ...hub,
      city: (hub as any).city ? { id: (hub as any).city.id, name: (hub as any).city.name } : null,
    }
  }
}
