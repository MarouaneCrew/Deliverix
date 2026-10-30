import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  UseGuards,
} from '@nestjs/common';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { UserRole } from '../generated/prisma/enums';
import { Roles } from '../auth/decorators/roles.decorator';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { CreateHubDto } from './dto/create-hub.dto';
import { UpdateHubDto } from './dto/update-hub.dto';
import { HubsService } from './hubs.service';

@Controller('hubs')
export class HubsController {
  constructor(private readonly hubsService: HubsService) {}

  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(
    @CurrentUser() actor: Express.User,
    @Body() createHubDto: CreateHubDto,
  ) {
    return this.hubsService.create(actor.companyId, createHubDto);
  }

  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.DRIVER,
    UserRole.MERCHANT,
  )
  findAll(@CurrentUser() actor: Express.User) {
    return this.hubsService.findAll(actor.companyId);
  }

  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.DRIVER,
    UserRole.MERCHANT,
  )
  findOne(@CurrentUser() actor: Express.User, @Param('id') id: string) {
    return this.hubsService.findOne(actor.companyId, id);
  }

  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(
    @CurrentUser() actor: Express.User,
    @Param('id') id: string,
    @Body() updateHubDto: UpdateHubDto,
  ) {
    return this.hubsService.update(actor.companyId, id, updateHubDto);
  }
}
