import { Injectable, NestInterceptor, ExecutionContext, CallHandler } from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { randomUUID } from 'node:crypto';
import { Logger } from '@nestjs/common';

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
    private readonly logger = new Logger('HTTP');

    intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
        const ctx = context.switchToHttp();
        const req = ctx.getRequest();
        const res = ctx.getResponse();

        const headerId = req.headers['x-request-id'];
        const requestId = typeof headerId === 'string' && /^[A-Za-z0-9_-]{1,64}$/.test(headerId)
            ? headerId
            : randomUUID();

        res.setHeader('x-request-id', requestId);

        const start = Date.now();
        const method = req.method;
        const originalUrl = req.originalUrl ?? '';
        const path = originalUrl.split('?')[0];
        const userId = req.user?.userId ?? null;

        res.once('finish', () => {
            if (process.env.NODE_ENV !== 'test') {
                const durationMs = Date.now() - start;
                const statusCode = res.statusCode;
                this.logger.log(JSON.stringify({ requestId, method, path, statusCode, durationMs, userId }));
            }
        });

        return next.handle();
    }
}