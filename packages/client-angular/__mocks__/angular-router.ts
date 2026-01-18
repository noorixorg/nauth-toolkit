/**
 * Mock for @angular/router
 */
export class Router {
  createUrlTree(_commands: any[], _navigationExtras?: any): any {
    return {};
  }
  navigateByUrl(_url: string): Promise<boolean> {
    return Promise.resolve(true);
  }
}

export type UrlTree = any;
export type ActivatedRouteSnapshot = any;
export type RouterStateSnapshot = any;
export type CanActivateFn = (route: ActivatedRouteSnapshot, state: RouterStateSnapshot) => any;
