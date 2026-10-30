import type { Provider } from "@nestjs/common"
import { PrismaService } from "@prisma/prisma.service"
import { CompanyRepository } from "./impl/company.repository"
import { CityRepository } from "./impl/city.repository"
import { HubRepository } from "./impl/hub.repository"
import { UserRepository } from "./impl/user.repository"
import { MerchantRepository } from "./impl/merchant.repository"
import { DriverRepository } from "./impl/driver.repository"

export const repositoryProviders: Provider[] = [
  {
    provide: "CompanyRepository",
    useClass: CompanyRepository,
  },
  {
    provide: "CityRepository",
    useClass: CityRepository,
  },
  {
    provide: "HubRepository",
    useClass: HubRepository,
  },
  {
    provide: "UserRepository",
    useClass: UserRepository,
  },
  {
    provide: "MerchantRepository",
    useClass: MerchantRepository,
  },
  {
    provide: "DriverRepository",
    useClass: DriverRepository,
  },
]

// Export convenience injection tokens
export const COMPANY_REPOSITORY_TOKEN = "CompanyRepository"
export const CITY_REPOSITORY_TOKEN = "CityRepository"
export const HUB_REPOSITORY_TOKEN = "HubRepository"
export const USER_REPOSITORY_TOKEN = "UserRepository"
export const MERCHANT_REPOSITORY_TOKEN = "MerchantRepository"
export const DRIVER_REPOSITORY_TOKEN = "DriverRepository"
