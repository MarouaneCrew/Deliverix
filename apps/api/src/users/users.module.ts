import { Module } from "@nestjs/common"
import { UsersService } from "./users.service"
import { UsersController } from "./users.controller"
import { UserRepository } from "../common/repositories/impl/user.repository"
import { repositoryProviders } from "../common/repositories/repository.providers"

@Module({
  controllers: [UsersController],
  providers: [UsersService, UserRepository, ...repositoryProviders],
  exports: [UsersService, UserRepository],
})
export class UsersModule {}
