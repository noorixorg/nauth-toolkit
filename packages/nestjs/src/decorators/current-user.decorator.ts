import { createParamDecorator, ExecutionContext } from '@nestjs/common';

/**
 * Extract current user from request
 * @example
 * @Get('profile')
 * getProfile(@CurrentUser() user: User) { return user; }
 */
export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext) => {
  const request = ctx.switchToHttp().getRequest();
  return request.user;
});
