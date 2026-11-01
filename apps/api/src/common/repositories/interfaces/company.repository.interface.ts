import type { Company } from "@/generated/prisma/client"

/**
 * Repository interface for Company aggregate.
 *
 * Companies are root aggregates - all other entities (except City) are
 * scoped to a company via companyId foreign key.
 */
export interface ICompanyRepository {
  /**
   * Find all companies (soft-deleted excluded).
   */
  findAll(): Promise<Company[]>

  /**
   * Find a company by ID.
   * @param id - Company ID
   */
  findOne(id: string): Promise<Company | null>

  /**
   * Create a new company.
   * @param data - Company data
   */
  create(data: { name: string }): Promise<Company>

  /**
   * Update a company.
   * @param id - Company ID
   * @param data - Updated data
   */
  update(id: string, data: Partial<Company>): Promise<Company>

  /**
   * Soft-delete a company.
   * @param id - Company ID
   */
  delete(id: string): Promise<void>

  /**
   * Find company by name (case-insensitive).
   * @param name - Company name
   */
  findByName(name: string): Promise<Company | null>
}
