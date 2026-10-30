import {
  Injectable,
  NotFoundException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { CreateMerchantDto } from './dto/create-merchant.dto';
import { UpdateMerchantDto } from './dto/update-merchant.dto';
import { CreateMerchantAccountDto } from './dto/create-merchant-account.dto';
import { UserRole } from '../generated/prisma/enums';

@Injectable()
export class MerchantsService {
  constructor(private prisma: PrismaService) {}

  /**
   * Creates a new merchant business record (without login).
   * The merchant exists as a business entity; login can be attached later via attachAccount.
   * ADMIN and DISPATCHER can create merchants for their company.
   */
  async create(companyId: string, dto: CreateMerchantDto) {
    const city = await this.prisma.city.findUnique({
      where: { id: dto.cityId },
    });
    if (!city) {
      throw new NotFoundException('City not found');
    }

    const merchant = await this.prisma.merchant.create({
      data: {
        companyId,
        cityId: dto.cityId,
        name: dto.name,
        phone: dto.phone,
        address: dto.address,
        userId: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        cityId: true,
        city: { select: { id: true, name: true } },
        isActive: true,
        userId: true,
        createdAt: true,
      },
    });

    return {
      ...merchant,
      hasLogin: merchant.userId !== null,
    };
  }

  /**
   * Lists all merchants in the company (excludes soft-deleted).
   * Returns merchant business data with hasLogin flag indicating if a user account exists.
   */
  async findAll(companyId: string) {
    const merchants = await this.prisma.merchant.findMany({
      where: {
        companyId,
        deletedAt: null,
      },
      orderBy: { name: 'asc' },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        cityId: true,
        city: { select: { id: true, name: true } },
        isActive: true,
        userId: true,
        createdAt: true,
      },
    });

    return merchants.map((m) => ({
      ...m,
      hasLogin: m.userId !== null,
    }));
  }

  /**
   * Retrieves a single merchant by ID within the company scope.
   * Returns 404 if merchant doesn't exist or belongs to another company.
   */
  async findOne(companyId: string, id: string) {
    const merchant = await this.prisma.merchant.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        cityId: true,
        city: { select: { id: true, name: true } },
        isActive: true,
        userId: true,
        createdAt: true,
      },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    return {
      ...merchant,
      hasLogin: merchant.userId !== null,
    };
  }

  /**
   * Retrieves the merchant record associated with the authenticated merchant user.
   * Used by merchant users to access their own business data via GET /merchants/me.
   */
  async findMyMerchant(companyId: string, userId: string) {
    const merchant = await this.prisma.merchant.findFirst({
      where: {
        companyId,
        userId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        cityId: true,
        city: { select: { id: true, name: true } },
        isActive: true,
        userId: true,
        createdAt: true,
      },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    return {
      ...merchant,
      hasLogin: merchant.userId !== null,
    };
  }

  /**
   * Retrieves a specific merchant record for a merchant user.
   * Enforces that merchant users can only access their own merchant record (userId must match).
   * Returns 404 if the merchant doesn't belong to the requesting user.
   */
  async findOneMerchantUser(
    companyId: string,
    actorUserId: string,
    id: string,
  ) {
    const merchant = await this.prisma.merchant.findFirst({
      where: {
        id,
        companyId,
        userId: actorUserId,
        deletedAt: null,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        cityId: true,
        city: { select: { id: true, name: true } },
        isActive: true,
        userId: true,
        createdAt: true,
      },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    return {
      ...merchant,
      hasLogin: merchant.userId !== null,
    };
  }

  /**
   * Updates merchant business information (name, city, phone, address, active status).
   * ADMIN and DISPATCHER can update merchants in their company.
   * Validates that the new city exists if cityId is being changed.
   */
  async update(companyId: string, id: string, dto: UpdateMerchantDto) {
    const merchant = await this.prisma.merchant.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    if (dto.cityId) {
      const city = await this.prisma.city.findUnique({
        where: { id: dto.cityId },
      });
      if (!city) {
        throw new NotFoundException('City not found');
      }
    }

    const updatedMerchant = await this.prisma.merchant.update({
      where: { id, companyId },
      data: {
        name: dto.name,
        cityId: dto.cityId,
        phone: dto.phone,
        address: dto.address,
        isActive: dto.isActive,
      },
      select: {
        id: true,
        name: true,
        phone: true,
        address: true,
        cityId: true,
        city: { select: { id: true, name: true } },
        isActive: true,
        userId: true,
        createdAt: true,
      },
    });

    return {
      ...updatedMerchant,
      hasLogin: updatedMerchant.userId !== null,
    };
  }

  /**
   * Soft-deletes a merchant (sets isActive=false, deletedAt=now).
   * If the merchant has an associated user account, that account is also soft-deleted in the same transaction.
   * This ensures the merchant can no longer login and won't appear in listings.
   * ADMIN only.
   */
  async remove(companyId: string, id: string) {
    const merchant = await this.prisma.merchant.findFirst({
      where: {
        id,
        companyId,
        deletedAt: null,
      },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    await this.prisma.$transaction(async (tx) => {
      await tx.merchant.update({
        where: { id, companyId },
        data: {
          isActive: false,
          deletedAt: new Date(),
        },
      });

      if (merchant.userId) {
        await tx.user.update({
          where: { id: merchant.userId },
          data: {
            isActive: false,
            deletedAt: new Date(),
          },
        });
      }
    });

    return { id };
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
  async attachAccount(
    companyId: string,
    merchantId: string,
    dto: CreateMerchantAccountDto,
  ) {
    const merchant = await this.prisma.merchant.findFirst({
      where: {
        id: merchantId,
        companyId,
        deletedAt: null,
      },
    });

    if (!merchant) {
      throw new NotFoundException('Merchant not found');
    }

    if (merchant.userId) {
      throw new ConflictException('Merchant already has a login');
    }

    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('Email already exists');
    }

    const bcrypt = await import('bcryptjs');
    const passwordHash = await bcrypt.hash(dto.password, 10);

    const updatedMerchant = await this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: dto.email,
          passwordHash,
          fullName: dto.email,
          role: UserRole.MERCHANT,
          companyId,
          hubId: null,
          isActive: true,
        },
        select: {
          id: true,
          email: true,
          role: true,
        },
      });

      return await tx.merchant.update({
        where: { id: merchantId, companyId },
        data: {
          userId: user.id,
        },
        select: {
          id: true,
          userId: true,
        },
      });
    });

    return {
      merchantId,
      userId: updatedMerchant.userId,
      email: dto.email,
    };
  }
}
