import { Module } from '@nestjs/common';
import { CitiesService } from './cities.service';
import { CitiesController } from './cities.controller';
import { HubsService } from './hubs.service';
import { HubsController } from './hubs.controller';

@Module({
  controllers: [CitiesController, HubsController],
  providers: [CitiesService, HubsService],
})
export class NetworkModule {}
