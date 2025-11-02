import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Observable } from 'rxjs';

@Injectable()
export class WebhookAuthGuard implements CanActivate {
  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    // Headers no Express são case-insensitive mas pode variar, verificar todas as possibilidades
    const authHeader =
      request.headers['x-webhook-secret'] ||
      request.headers['X-Webhook-Secret'] ||
      request.headers['authorization'] ||
      request.headers['Authorization'] ||
      request.get?.('x-webhook-secret') ||
      request.get?.('X-Webhook-Secret') ||
      request.get?.('authorization') ||
      request.get?.('Authorization');

    if (!authHeader) {
      throw new UnauthorizedException('Webhook secret is required');
    }

    // Suporta tanto X-Webhook-Secret header quanto Bearer token
    const secret = authHeader.startsWith('Bearer ') ? authHeader.substring(7) : authHeader;

    const configSecret = this.configService.get<string>('webhook.secret');

    if (!configSecret) {
      throw new UnauthorizedException('Webhook secret not configured');
    }

    if (secret !== configSecret) {
      throw new UnauthorizedException('Invalid webhook secret');
    }

    return true;
  }
}
