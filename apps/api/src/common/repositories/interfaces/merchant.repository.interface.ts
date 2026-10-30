import type { Merchant, City, User } from "@generated/prisma/client"

/**
 * Repository interface for Merchant aggregate.
 *
 * Merchants represent business entities. They can exist without a user
 * account (optional 1:1 relationship). When a login is created, the
 * merchant and user are linked via userId.
 */
export type MerchantWithCityAndUser = Merchant & {
  city: City
  user: User | null
}

export interface IMerchantRepository {
  /**
   * Find all merchants for a company (soft-deleted excluded).
   * @param companyId - Company ID
   */
  findAllByCompany(companyId: string): Promise<MerchantWithCityAndUser[]>

  /**
   * Find all active merchants for a company.
   * @param companyId - Company ID
   */
  findActiveByCompany(companyId: string): Promise<MerchantWithCityAndUser[]>

  /**
   * Find a merchant by ID within a company.
   * @param companyId - Company ID
   * @param id - Merchant ID
   */
  findOne(companyId: string, id: string): Promise<MerchantWithCityAndUser | null>

  /**
   * Find a merchant by user ID.
   * @param userId - User ID (merchant login user)
   */
  findByUserId(userId: string): Promise<MerchantWithCityAndUser | null>

  /**
   * Find a merchant by phone.
   * @param phone - Phone number
   */
  findByPhone(phone: string): Promise<MerchantWithCityAndUser | null>

  /**
   * Create a new merchant.
   * @param data - Merchant data
   */
  create(data: {
    companyId: string
    userId?: string | null
    cityId: string
    name: string
    phone?: string
    address?: string
  }): Promise<MerchantWithCityAndUser>

  /**
   * Update a merchant.
   * @param companyId - Company ID
   * @param id - Merchant ID
   * @param data - Updated data
   */
  update(companyId: string, id: string, data: Partial<Merchant>): Promise<MerchantWithCityAndUser>

  /**
   * Link a user to a merchant (create login).
   * @param companyId - Company ID
   * @param id - Merchant ID
   * @param userId - User ID to link
   */
  linkUser(companyId: string, id: string, userId: string): Promise<MerchantWithCityAndUser>

  /**
   * Unlink user from merchant (disable login).
   * @param companyId - Company ID
   * @param id - Merchant ID
   */
  unlinkUser(companyId: string, id: string): Promise<MerchantWithCityAndUser>

  /**
   * Soft-delete a merchant.
   * @param companyId - Company ID
   * @param id - Merchant ID
   */
  delete(companyId: string, id: string): Promise<void>
}
