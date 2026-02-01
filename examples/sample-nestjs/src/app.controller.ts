import { Controller, Get } from '@nestjs/common';
import { AppService } from './app.service';
import { TestService } from './test.service';

/**
 * Main application controller
 * Provides health check and basic info endpoints
 */
@Controller()
export class AppController {
  constructor(
    private readonly appService: AppService,
    private readonly testService: TestService,
  ) {}

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

  /**
   * Test nauth-toolkit integration
   * Tests password hashing from local package
   * @returns Test results
   */
  @Get('test-nauth')
  async testNauth() {
    return this.testService.testPasswordHashing();
  }
}
