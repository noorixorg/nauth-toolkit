import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * Basic health check and info endpoints.
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  getHealth() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('health')
  getHealthAlt() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }

  @Get('info')
  getInfo() {
    return this.appService.getInfo();
  }
}
