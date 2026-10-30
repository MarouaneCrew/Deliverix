import {
  Injectable,
  type NestInterceptor,
  type ExecutionContext,
  type CallHandler,
} from "@nestjs/common"
import type { Observable } from "rxjs"
import { randomUUID } from "node:crypto"
import { Logger } from "@nestjs/common"
import type { Request, Response } from "express"

@Injectable()
export class RequestLoggingInterceptor implements NestInterceptor {
  private readonly logger = new Logger("HTTP")

  intercept(context: ExecutionContext, next: CallHandler): Observable<unknown> {
    const ctx = context.switchToHttp()
    const req = ctx.getRequest<Request>()
    const res = ctx.getResponse<Response>()

    const headerId = req.headers["x-request-id"]
    const requestId =
      typeof headerId === "string" && /^[A-Za-z0-9_-]{1,64}$/.test(headerId)
        ? headerId
        : randomUUID()

    res.setHeader("x-request-id", requestId)

    const start = Date.now()
    const method = req.method
    const originalUrl = req.originalUrl ?? ""
    const path = originalUrl.split("?")[0]
    const userId = req.user?.userId ?? null

    res.once("finish", () => {
      if (process.env.NODE_ENV !== "test") {
        const durationMs = Date.now() - start
        const statusCode = res.statusCode
        this.logger.log(
          JSON.stringify({
            requestId,
            method,
            path,
            statusCode,
            durationMs,
            userId,
          }),
        )
      }
    })

    return next.handle()
  }
}
