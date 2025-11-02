import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

@Injectable()
export class WebhookAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const secret = this.extractSecret(request);

    this.validateSecret(secret);

    return true;
  }

  private extractSecret(request: Request): string {
    const webhookHeader = this.getHeader(request, 'x-webhook-secret');
    const authHeader = this.getHeader(request, 'authorization');

    const headerValue = webhookHeader || authHeader;

    if (!headerValue) {
      throw new UnauthorizedException('Webhook secret is required');
    }

    return this.extractBearerToken(headerValue);
  }

  private getHeader(request: Request, headerName: string): string | undefined {
    const lowerName = headerName.toLowerCase();
    const headers = (request.headers as unknown as Record<string, string | undefined>) || {};

    for (const key in headers) {
      if (key.toLowerCase() === lowerName) {
        return headers[key];
      }
    }

    const getMethod = (request as { get?: (name: string) => string | undefined }).get;
    return getMethod?.call(request, headerName);
  }

  private extractBearerToken(headerValue: string): string {
    const BEARER_PREFIX = 'Bearer ';
    return headerValue.startsWith(BEARER_PREFIX) ? headerValue.substring(BEARER_PREFIX.length) : headerValue;
  }

  private validateSecret(secret: string): void {
    const configSecret = this.configService.get<string>('webhook.secret');

    if (!configSecret) {
      throw new UnauthorizedException('Webhook secret not configured');
    }

    if (secret !== configSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }
  }
}
