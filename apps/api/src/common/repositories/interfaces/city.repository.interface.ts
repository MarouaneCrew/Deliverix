import type { City } from "@generated/prisma/client"

/**
 * Repository interface for City reference data.
 *
 * Cities are SHARED reference data (NOT tenant-owned). They are created
 * and managed centrally, then referenced by hubs and merchants across
 * all companies.
 */
export interface ICityRepository {
  /**
   * Find all cities (soft-deleted excluded).
   */
  findAll(): Promise<City[]>

  /**
   * Find a city by ID.
   * @param id - City ID
   */
  findOne(id: string): Promise<City | null>

  /**
   * Find a city by name (case-insensitive).
   * @param name - City name
   */
  findByName(name: string): Promise<City | null>

  /**
   * Create a new city.
   * @param data - City data
   */
  create(data: { name: string }): Promise<City>

  /**
   * Update a city.
   * @param id - City ID
   * @param data - Updated data
   */
  update(id: string, data: Partial<City>): Promise<City>

  /**
   * Soft-delete a city.
   * @param id - City ID
   */
  delete(id: string): Promise<void>
}
