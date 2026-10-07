import { Controller, Get, Inject } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { PrismaService } from '../prisma/prisma.service';
import { ServiceUnavailableException } from '@nestjs/common';

@SkipThrottle()
@Controller('health')
export class HealthController {
    constructor(
        @Inject(PrismaService)
        private readonly prisma: PrismaService,
    ) {}

    @Get()
    async check() {
        try {
            await this.prisma.$queryRaw`SELECT 1`;
            return { status: 'ok' };
        } catch {
            throw new ServiceUnavailableException('Database unavailable');
        }
    }
}