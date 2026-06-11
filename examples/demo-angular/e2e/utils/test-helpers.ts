import { Page } from '@playwright/test';
import { faker } from '@faker-js/faker';
import { SignupData } from './flow-builders';

/**
 * Generates unique test data for each test
 *
 * @returns SignupData with unique values
 */
export function generateTestData(): SignupData {
  return {
    email: faker.internet.email().toLowerCase(),
    password: 'Test123!@#',
    firstName: faker.person.firstName(),
    lastName: faker.person.lastName(),
    phone: `+1${faker.string.numeric(10)}`,
  };
}

/**
 * Extracts userId from various sources
 *
 * @param page - Playwright page instance
 * @returns User ID string
 * @throws Error if userId cannot be extracted
 */
export async function extractUserId(page: Page): Promise<string> {
  // Try localStorage
  let userId = await page.evaluate(() => localStorage.getItem('userId'));
  if (userId) return userId;

  // Try URL
  const url = page.url();
  const match = url.match(/user[\/=]([a-f0-9-]+)/i);
  if (match) return match[1];

  // Try API response (if stored)
  userId = await page.evaluate(() => sessionStorage.getItem('userId'));
  if (userId) return userId;

  throw new Error('Could not extract userId');
}

