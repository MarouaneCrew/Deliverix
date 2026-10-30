import type { User, UserRole } from "@generated/prisma/client"

/**
 * Repository interface for User aggregate.
 *
 * Users represent people (staff/drivers/merchants) with authentication
 * credentials. Users are scoped to a company and optionally to a hub
 * (for DISPATCHER role).
 */
export interface IUserRepository {
  /**
   * Find all users for a company (soft-deleted excluded).
   * @param companyId - Company ID
   */
  findAllByCompany(companyId: string): Promise<User[]>

  /**
   * Find all dispatchers for a company and hub.
   * @param companyId - Company ID
   * @param hubId - Hub ID
   */
  findDispatchersByHub(companyId: string, hubId: string): Promise<User[]>

  /**
   * Find a user by ID within a company.
   * @param companyId - Company ID
   * @param id - User ID
   */
  findOne(companyId: string, id: string): Promise<User | null>

  /**
   * Find a user by email (global unique).
   * @param email - Email address
   */
  findByEmail(email: string): Promise<User | null>

  /**
   * Find a user by phone.
   * @param phone - Phone number
   */
  findByPhone(phone: string): Promise<User | null>

  /**
   * Create a new user.
   * @param data - User data
   */
  create(data: {
    email: string
    passwordHash: string
    fullName: string
    phone?: string
    role: UserRole
    companyId: string
    hubId?: string | null
  }): Promise<User>

  /**
   * Update a user.
   * @param companyId - Company ID
   * @param id - User ID
   * @param data - Updated data
   */
  update(companyId: string, id: string, data: Partial<User>): Promise<User>

  /**
   * Soft-delete a user.
   * @param companyId - Company ID
   * @param id - User ID
   */
  delete(companyId: string, id: string): Promise<void>

  /**
   * Update user authentication tokens.
   * @param userId - User ID
   * @param tokenData - Token data (refreshTokenHash, refreshTokenExpiresAt, etc.)
   */
  updateAuthenticationTokens(
    userId: string,
    tokenData: {
      refreshTokenHash?: string | null
      refreshTokenExpiresAt?: Date | null
      resetTokenHash?: string | null
      resetTokenExpiresAt?: Date | null
    },
  ): Promise<User>

  /**
   * Find a user by refresh token hash.
   * @param refreshTokenHash - SHA-256 hash of the refresh token
   */
  findByRefreshTokenHash(refreshTokenHash: string): Promise<User | null>

  /**
   * Find a user by reset token hash.
   * @param resetTokenHash - SHA-256 hash of the reset token
   */
  findByResetTokenHash(resetTokenHash: string): Promise<User | null>
}
