/**
 * Mock for @angular/common
 */
export function isPlatformBrowser(platformId: string): boolean {
  return platformId === 'browser';
}
