import { Injectable, NotFoundException, ConflictException } from "@nestjs/common"
import { Inject } from "@nestjs/common"
import { MerchantRepository } from "@/common/repositories/impl/merchant.repository"
import { CityRepository } from "@/common/repositories/impl/city.repository"
import { UserRepository } from "@/common/repositories/impl/user.repository"
import { CreateMerchantDto } from "./dto/create-merchant.dto"
import { UpdateMerchantDto } from "./dto/update-merchant.dto"
import { CreateMerchantAccountDto } from "./dto/create-merchant-account.dto"
import { UserRole } from "@/generated/prisma/enums"

@Injectable()
export class MerchantsService {
  constructor(
    private readonly merchantRepository: MerchantRepository,
    private readonly cityRepository: CityRepository,
    private readonly userRepository: UserRepository,
  ) {}

  /**
   * Creates a new merchant business record (without login).
   * The merchant exists as a business entity; login can be attached later via attachAccount.
   * ADMIN and DISPATCHER can create merchants for their company.
   */
  async create(companyId: string, dto: CreateMerchantDto) {
    const city = await this.cityRepository.findOne(dto.cityId)
    if (!city) {
      throw new NotFoundException("City not found")
    }

    const merchant = await this.merchantRepository.create({
      companyId,
      cityId: dto.cityId,
      name: dto.name,
      phone: dto.phone,
      address: dto.address,
      userId: null as string | null,
    })

    const m = merchant as any
    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      address: m.address,
      cityId: m.cityId,
      city: m.city ? { id: m.city.id, name: m.city.name } : null,
      isActive: m.isActive,
      userId: m.userId,
      createdAt: m.createdAt,
      hasLogin: m.userId !== null,
    }
  }

  /**
   * Lists all merchants in the company (excludes soft-deleted).
   * Returns merchant business data with hasLogin flag indicating if a user account exists.
   */
  async findAll(companyId: string) {
    const merchants = await this.merchantRepository.findAllByCompany(companyId)

    return merchants.map(m => ({
      id: m.id,
      name: m.name,
      phone: m.phone,
      address: m.address,
      cityId: m.cityId,
      city: (m as any).city ? { id: (m as any).city.id, name: (m as any).city.name } : null,
      isActive: m.isActive,
      userId: m.userId,
      createdAt: m.createdAt,
      hasLogin: m.userId !== null,
    }))
  }

  /**
   * Retrieves a single merchant by ID within the company scope.
   * Returns 404 if merchant doesn't exist or belongs to another company.
   */
  async findOne(companyId: string, id: string) {
    const merchant = await this.merchantRepository.findOne(companyId, id)

    if (!merchant) {
      throw new NotFoundException("Merchant not found")
    }

    const m = merchant as any
    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      address: m.address,
      cityId: m.cityId,
      city: m.city ? { id: m.city.id, name: m.city.name } : null,
      isActive: m.isActive,
      userId: m.userId,
      createdAt: m.createdAt,
      hasLogin: m.userId !== null,
    }
  }

  /**
   * Retrieves the merchant record associated with the authenticated merchant user.
   * Used by merchant users to access their own business data via GET /merchants/me.
   */
  async findMyMerchant(companyId: string, userId: string) {
    const merchant = await this.merchantRepository.findByUserId(userId)

    if (!merchant || merchant.companyId !== companyId) {
      throw new NotFoundException("Merchant not found")
    }

    const m = merchant as any
    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      address: m.address,
      cityId: m.cityId,
      city: m.city ? { id: m.city.id, name: m.city.name } : null,
      isActive: m.isActive,
      userId: m.userId,
      createdAt: m.createdAt,
      hasLogin: m.userId !== null,
    }
  }

  /**
   * Retrieves a specific merchant record for a merchant user.
   * Enforces that merchant users can only access their own merchant record (userId must match).
   * Returns 404 if the merchant doesn't belong to the requesting user.
   */
  async findOneMerchantUser(companyId: string, actorUserId: string, id: string) {
    const merchant = await this.merchantRepository.findOne(companyId, id)

    if (!merchant || merchant.userId !== actorUserId) {
      throw new NotFoundException("Merchant not found")
    }

    const m = merchant as any
    return {
      id: m.id,
      name: m.name,
      phone: m.phone,
      address: m.address,
      cityId: m.cityId,
      city: m.city ? { id: m.city.id, name: m.city.name } : null,
      isActive: m.isActive,
      userId: m.userId,
      createdAt: m.createdAt,
      hasLogin: m.userId !== null,
    }
  }

  /**
   * Updates merchant business information (name, city, phone, address, active status).
   * ADMIN and DISPATCHER can update merchants in their company.
   * Validates that the new city exists if cityId is being changed.
   */
  async update(companyId: string, id: string, dto: UpdateMerchantDto) {
    const merchant = await this.merchantRepository.findOne(companyId, id)

    if (!merchant) {
      throw new NotFoundException("Merchant not found")
    }

    if (dto.cityId) {
      const city = await this.cityRepository.findOne(dto.cityId)
      if (!city) {
        throw new NotFoundException("City not found")
      }
    }

    const updatedMerchant = await this.merchantRepository.update(companyId, id, {
      name: dto.name,
      cityId: dto.cityId,
      phone: dto.phone,
      address: dto.address,
      isActive: dto.isActive,
    })

    return {
      id: updatedMerchant.id,
      name: updatedMerchant.name,
      phone: updatedMerchant.phone,
      address: updatedMerchant.address,
      cityId: updatedMerchant.cityId,
      city: (updatedMerchant as any).city
        ? { id: (updatedMerchant as any).city.id, name: (updatedMerchant as any).city.name }
        : null,
      isActive: updatedMerchant.isActive,
      userId: updatedMerchant.userId,
      createdAt: updatedMerchant.createdAt,
      hasLogin: updatedMerchant.userId !== null,
    }
  }

  /**
   * Soft-deletes a merchant (sets isActive=false, deletedAt=now).
   * If the merchant has an associated user account, that account is also soft-deleted in the same transaction.
   * This ensures the merchant can no longer login and won't appear in listings.
   * ADMIN only.
   */
  async remove(companyId: string, id: string) {
    const merchant = await this.merchantRepository.findOne(companyId, id)

    if (!merchant) {
      throw new NotFoundException("Merchant not found")
    }

    await this.merchantRepository.delete(companyId, id)

    return { id }
  }

  /**
   * Attaches a login account to an existing merchant business record.
   * Creates a new User with role MERCHANT and links it to the merchant via userId.
   * This allows the merchant to login and access their business data via /merchants/me.
   *
   * Validations:
   * - Merchant must exist and not be deleted
   * - Merchant must not already have a login (userId must be null)
   * - Email must not be taken by another user
   *
   * ADMIN and DISPATCHER can attach accounts.
   */
  async attachAccount(companyId: string, merchantId: string, dto: CreateMerchantAccountDto) {
    const merchant = await this.merchantRepository.findOne(companyId, merchantId)

    if (!merchant) {
      throw new NotFoundException("Merchant not found")
    }

    if (merchant.userId) {
      throw new ConflictException("Merchant already has a login")
    }

    const existingUser = await this.userRepository.findByEmail(dto.email)

    if (existingUser) {
      throw new ConflictException("Email already exists")
    }

    const bcrypt = await import("bcryptjs")
    const passwordHash = await bcrypt.hash(dto.password, 10)

    const user = await this.userRepository.create({
      email: dto.email,
      passwordHash,
      fullName: dto.email,
      role: UserRole.MERCHANT,
      companyId,
      hubId: null as string | null,
    })

    const updatedMerchant = await this.merchantRepository.linkUser(companyId, merchantId, user.id)

    return {
      merchantId: updatedMerchant.id,
      userId: updatedMerchant.userId,
      email: dto.email,
    }
  }
}
