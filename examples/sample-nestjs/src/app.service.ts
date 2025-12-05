import { Injectable } from '@nestjs/common';

/**
 * Main application service
 */
@Injectable()
export class AppService {
  /**
   * Get application information
   * @returns Application details
   */
  getInfo() {
    return {
      name: 'nauth-toolkit Sample App',
      version: '0.1.0',
      description: 'Sample NestJS application for testing nauth-toolkit',
      environment: process.env.NODE_ENV || 'development',
      database: {
        host: process.env.DB_HOST,
        port: process.env.DB_PORT,
        database: process.env.DB_DATABASE,
      },
      features: ['Basic NestJS setup', 'TypeORM + PostgreSQL connection', 'Environment configuration', 'Ready for nauth-toolkit integration'],
      nextSteps: [
        'Install nauth-toolkit: yarn add @nauth-toolkit/core',
        'Follow GETTING_STARTED.md for integration',
        'Configure authentication in app.module.ts',
      ],
    };
  }
}
