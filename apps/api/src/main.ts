import "dotenv/config"
import { NestFactory } from "@nestjs/core"
import type { Express } from "express"
import { AppModule } from "./app.module"
import { Logger, ValidationPipe } from "@nestjs/common"
import { DocumentBuilder, SwaggerModule } from "@nestjs/swagger"

async function bootstrap() {
  const requiredEnvVars = ["JWT_SECRET", "DATABASE_URL"]
  const missing = requiredEnvVars.filter(key => !process.env[key])

  if (missing.length > 0) {
    Logger.error(`Missing required environment variable: ${missing.join(", ")}`, "Bootstrap")
    process.exit(1)
  }

  const app = await NestFactory.create(AppModule)
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      transform: true,
    }),
  )

  const config = new DocumentBuilder()
    .setTitle("Deliverix API")
    .setVersion("1.0")
    .addBearerAuth()
    .build()
  SwaggerModule.setup("docs", app, SwaggerModule.createDocument(app, config))
  void app.listen(process.env.PORT ?? 3000)
}
void bootstrap()
