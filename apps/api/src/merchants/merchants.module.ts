import { Module } from "@nestjs/common"
import { MerchantsController } from "./merchants.controller"
import { MerchantsService } from "./merchants.service"
import { CommonRepositoriesModule } from "@/common/repositories/common-repositories.module"

@Module({
  imports: [CommonRepositoriesModule],
  controllers: [MerchantsController],
  providers: [MerchantsService],
  exports: [MerchantsService],
})
export class MerchantsModule {}
