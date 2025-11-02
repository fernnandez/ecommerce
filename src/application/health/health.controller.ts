import { Public } from '@infra/decorator/public.decorator';
import { Controller, Get, HttpCode, HttpException, HttpStatus } from '@nestjs/common';
import { ApiOperation, ApiProperty, ApiResponse, ApiTags } from '@nestjs/swagger';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';

export class HealthResponse {
  @ApiProperty({ example: 'ok', enum: ['ok', 'error'] })
  status: 'ok' | 'error';

  @ApiProperty({ example: '2024-01-01T00:00:00.000Z' })
  timestamp: string;

  @ApiProperty({
    example: { status: 'connected', responseTime: 5 },
  })
  database: {
    status: 'connected' | 'disconnected';
    responseTime?: number;
  };
}

@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  @Get()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Health check',
    description: 'Returns the health status of the API and database connection',
  })
  @ApiResponse({
    status: 200,
    description: 'Service is healthy',
    type: HealthResponse,
  })
  @ApiResponse({
    status: 503,
    description: 'Service is unhealthy',
  })
  async check(): Promise<HealthResponse> {
    const timestamp = new Date().toISOString();
    const startTime = Date.now();

    let databaseStatus: 'connected' | 'disconnected' = 'disconnected';
    let responseTime: number | undefined;

    try {
      // Verifica conexão com o banco de dados
      await this.dataSource.query('SELECT 1');
      databaseStatus = 'connected';
      responseTime = Date.now() - startTime;
    } catch {
      databaseStatus = 'disconnected';
      responseTime = Date.now() - startTime;
    }

    const status = databaseStatus === 'connected' ? 'ok' : 'error';

    const response: HealthResponse = {
      status,
      timestamp,
      database: {
        status: databaseStatus,
        responseTime,
      },
    };

    // Retorna 503 se o serviço estiver unhealthy
    if (status === 'error') {
      throw new HttpException(response, HttpStatus.SERVICE_UNAVAILABLE);
    }

    return response;
  }
}
