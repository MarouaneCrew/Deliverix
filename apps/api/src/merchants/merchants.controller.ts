import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards } from "@nestjs/common"
import { JwtAuthGuard } from "@/auth/guards/jwt-auth.guard"
import { RolesGuard } from "@/auth/guards/roles.guard"
import type { MerchantsService } from "./merchants.service"
import { UserRole } from "@/generated/prisma/enums"
import type { CreateMerchantDto } from "./dto/create-merchant.dto"
import type { UpdateMerchantDto } from "./dto/update-merchant.dto"
import type { CreateMerchantAccountDto } from "./dto/create-merchant-account.dto"
import { CurrentUser } from "@/auth/decorators/current-user.decorator"
import { Roles } from "@/auth/decorators/roles.decorator"
import type { Express } from "express"

@Controller("merchants")
@UseGuards(JwtAuthGuard, RolesGuard)
export class MerchantsController {
  constructor(private merchantsService: MerchantsService) {}

  @Post()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  create(@CurrentUser() actor: Express.User, @Body() dto: CreateMerchantDto) {
    return this.merchantsService.create(actor.companyId, dto)
  }

  @Get()
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  findAll(@CurrentUser() actor: Express.User) {
    return this.merchantsService.findAll(actor.companyId)
  }

  @Get("me")
  @Roles(UserRole.MERCHANT)
  findMyMerchant(@CurrentUser() actor: Express.User) {
    return this.merchantsService.findMyMerchant(actor.companyId, actor.userId)
  }

  @Get(":id")
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER, UserRole.MERCHANT)
  findOne(@CurrentUser() actor: Express.User, @Param("id") id: string) {
    if (actor.role === UserRole.MERCHANT) {
      return this.merchantsService.findOneMerchantUser(actor.companyId, actor.userId, id)
    }
    return this.merchantsService.findOne(actor.companyId, id)
  }

  @Patch(":id")
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  update(
    @CurrentUser() actor: Express.User,
    @Param("id") id: string,
    @Body() dto: UpdateMerchantDto,
  ) {
    return this.merchantsService.update(actor.companyId, id, dto)
  }

  @Delete(":id")
  @Roles(UserRole.ADMIN)
  remove(@CurrentUser() actor: Express.User, @Param("id") id: string) {
    return this.merchantsService.remove(actor.companyId, id)
  }

  @Post(":id/account")
  @Roles(UserRole.ADMIN, UserRole.DISPATCHER)
  attachAccount(
    @CurrentUser() actor: Express.User,
    @Param("id") id: string,
    @Body() dto: CreateMerchantAccountDto,
  ) {
    return this.merchantsService.attachAccount(actor.companyId, id, dto)
  }
}
