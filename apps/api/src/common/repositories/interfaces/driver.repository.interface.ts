import type { Driver, DriverEngagement, DriverStatus } from "@/generated/prisma/client"

/**
 * Repository interface for Driver aggregate.
 *
 * Drivers are 1:1 extensions of User (role = DRIVER). Driver-specific
 * data (engagement type, status, home hub) lives here. companyId,
 * name, phone are inherited from the User row.
 */
export interface IDriverRepository {
  /**
   * Find all drivers for a company (via hub assignment).
   * @param companyId - Company ID
   */
  findAllByCompany(companyId: string): Promise<Driver[]>

  /**
   * Find all drivers assigned to a hub.
   * @param hubId - Hub ID
   */
  findAllByHub(hubId: string): Promise<Driver[]>

  /**
   * Find all available drivers for a hub.
   * @param hubId - Hub ID
   */
  findAvailableByHub(hubId: string): Promise<Driver[]>

  /**
   * Find a driver by user ID.
   * @param userId - User ID
   */
  findByUserId(userId: string): Promise<Driver | null>

  /**
   * Find a driver by ID.
   * @param id - Driver ID
   */
  findOne(id: string): Promise<Driver | null>

  /**
   * Create a new driver.
   * @param data - Driver data (userId, homeHubId, engagement, status)
   */
  create(data: {
    userId: string
    homeHubId: string
    engagement?: DriverEngagement
    status?: DriverStatus
  }): Promise<Driver>

  /**
   * Update a driver.
   * @param id - Driver ID
   * @param data - Updated data
   */
  update(id: string, data: Partial<Driver>): Promise<Driver>

  /**
   * Update driver status.
   * @param id - Driver ID
   * @param status - New status
   */
  updateStatus(id: string, status: DriverStatus): Promise<Driver>

  /**
   * Update driver home hub.
   * @param id - Driver ID
   * @param homeHubId - New home hub ID
   */
  updateHomeHub(id: string, homeHubId: string): Promise<Driver>
}
