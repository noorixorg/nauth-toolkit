import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';

/**
 * Main application controller
 * Provides health check and basic info endpoints
 */
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  /**
   * Health check endpoint
   * @returns Health status
   */
  @Get()
  getHealth() {
    return {
      status: 'ok',
      message: 'Sample app is running',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Health check endpoint (alternative path for Docker healthcheck)
   * @returns Health status
   */
  @Get('health')
  getHealthAlt() {
    return {
      status: 'ok',
      message: 'Sample app is running',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * Get application information
   * @returns Application details
   */
  @Get('info')
  getInfo() {
    return this.appService.getInfo();
  }

}
