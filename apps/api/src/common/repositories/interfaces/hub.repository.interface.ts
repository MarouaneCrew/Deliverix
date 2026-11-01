import type { Hub } from "@/generated/prisma/client"

/**
 * Repository interface for Hub aggregate.
 *
 * Hubs are tenant-owned (scoped to companyId). Each hub belongs to one
 * city (reference data) and can have multiple dispatchers and drivers.
 */
export interface IHubRepository {
  /**
   * Find all hubs for a company (soft-deleted excluded).
   * @param companyId - Company ID
   */
  findAllByCompany(companyId: string): Promise<Hub[]>

  /**
   * Find all active hubs for a company.
   * @param companyId - Company ID
   */
  findActiveByCompany(companyId: string): Promise<Hub[]>

  /**
   * Find a hub by ID within a company.
   * @param companyId - Company ID
   * @param id - Hub ID
   */
  findOne(companyId: string, id: string): Promise<Hub | null>

  /**
   * Find a hub by company and name.
   * @param companyId - Company ID
   * @param name - Hub name
   */
  findByCompanyAndName(companyId: string, name: string): Promise<Hub | null>

  /**
   * Create a new hub.
   * @param data - Hub data (companyId, cityId, name, address)
   */
  create(data: {
    companyId: string
    cityId: string
    name: string
    address?: string | null
  }): Promise<Hub>

  /**
   * Update a hub.
   * @param companyId - Company ID
   * @param id - Hub ID
   * @param data - Updated data
   */
  update(companyId: string, id: string, data: Partial<Hub>): Promise<Hub>

  /**
   * Soft-delete a hub.
   * @param companyId - Company ID
   * @param id - Hub ID
   */
  delete(companyId: string, id: string): Promise<void>
}
