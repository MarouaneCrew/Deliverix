import { Global, Module } from "@nestjs/common"
import { PrismaModule } from "@prisma/prisma.module"
import { repositoryProviders } from "./repository.providers"

@Global()
@Module({
  imports: [PrismaModule],
  providers: [...repositoryProviders],
  exports: [...repositoryProviders],
})
export class CommonRepositoriesModule {}
