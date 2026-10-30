import { Module } from "@nestjs/common"
import { CitiesService } from "./cities.service"
import { CitiesController } from "./cities.controller"
import { HubsService } from "./hubs.service"
import { HubsController } from "./hubs.controller"
import { CityRepository } from "../common/repositories/impl/city.repository"
import { HubRepository } from "../common/repositories/impl/hub.repository"
import { repositoryProviders } from "../common/repositories/repository.providers"

@Module({
  controllers: [CitiesController, HubsController],
  providers: [CitiesService, HubsService, CityRepository, HubRepository, ...repositoryProviders],
  exports: [CitiesService, HubsService, CityRepository, HubRepository],
})
export class NetworkModule {}
