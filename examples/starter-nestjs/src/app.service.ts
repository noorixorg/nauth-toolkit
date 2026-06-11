import { Injectable } from '@nestjs/common';

/**
 * Main application service.
 */
@Injectable()
export class AppService {
  getInfo() {
    return {
      name: 'nauth-toolkit NestJS Example',
      version: '0.1.0',
      environment: process.env.NODE_ENV || 'development',
      docs: 'https://nauth.dev',
    };
  }
}
