/**
 * Base repository interface providing common CRUD operations.
 *
 * @template T - The entity type
 * @template K - The ID type
 */
export interface IRepository<T, K> {
  /**
   * Find all records.
   */
  findAll(): Promise<T[]>

  /**
   * Find a single record by ID.
   * @param id - The record ID
   */
  findOne(id: K): Promise<T | null>

  /**
   * Find a single record by where clause.
   * @param where - The where clause
   */
  findBy(where: Partial<T>): Promise<T | null>

  /**
   * Create a new record.
   * @param data - The record data
   */
  create(data: Partial<T>): Promise<T>

  /**
   * Update an existing record.
   * @param id - The record ID
   * @param data - The updated data
   */
  update(id: K, data: Partial<T>): Promise<T>

  /**
   * Delete a record by ID.
   * @param id - The record ID
   */
  delete(id: K): Promise<void>

  /**
   * Find records by where clause.
   * @param where - The where clause
   */
  findMany(where?: Partial<T>): Promise<T[]>
}
