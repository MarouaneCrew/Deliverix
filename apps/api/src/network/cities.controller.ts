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
import { CreateCityDto } from './dto/create-city.dto';
import { UpdateCityDto } from './dto/update-city.dto';
import { CitiesService } from './cities.service';

/**
 * Cities controller - manages shared reference data for cities.
 * Cities are NOT tenant-owned (no companyId); they are global reference data.
 * ADMIN role required for modifications; all authenticated users can list/get cities.
 */
@Controller('cities')
export class CitiesController {
  constructor(private readonly citiesService: CitiesService) {}

  /**
   * Creates a new city in the global reference data.
   * ADMIN role required. City names are case-insensitive unique.
   * @param createCityDto - City name (trimmed, max 80 chars)
   * @returns Created city with id and name
   */
  @Post()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  create(@Body() createCityDto: CreateCityDto) {
    return this.citiesService.create(createCityDto);
  }

  /**
   * Lists all cities ordered by name (alphabetically ascending).
   * Public read access for all authenticated users (ADMIN, DISPATCHER, DRIVER, MERCHANT).
   * @returns Array of cities with id and name
   */
  @Get()
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.DRIVER,
    UserRole.MERCHANT,
  )
  findAll() {
    return this.citiesService.findAll();
  }

  /**
   * Retrieves a specific city by its ID.
   * Public read access for all authenticated users.
   * @param id - City ID (cuid)
   * @returns City with id and name
   * @throws NotFoundException if city not found
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(
    UserRole.ADMIN,
    UserRole.DISPATCHER,
    UserRole.DRIVER,
    UserRole.MERCHANT,
  )
  findOne(@Param('id') id: string) {
    return this.citiesService.findOne(id);
  }

  /**
   * Updates a city's name.
   * ADMIN role required. Case-insensitive duplicate detection.
   * @param id - City ID to update
   * @param updateCityDto - New name (optional)
   * @returns Updated city with id and name
   */
  @Patch(':id')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  update(@Param('id') id: string, @Body() updateCityDto: UpdateCityDto) {
    return this.citiesService.update(id, updateCityDto);
  }
}
