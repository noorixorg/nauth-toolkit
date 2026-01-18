/**
 * Mock for @angular/common/http
 */
import { Observable, of } from 'rxjs';

// Simple HttpHeaders mock
export class HttpHeaders {
  private headers: Map<string, string> = new Map();

  constructor(init?: Record<string, string | string[]>) {
    if (init) {
      Object.entries(init).forEach(([key, value]) => {
        this.headers.set(key.toLowerCase(), Array.isArray(value) ? value[0] : value);
      });
    }
  }

  get(name: string): string | null {
    return this.headers.get(name.toLowerCase()) ?? null;
  }
}

export class HttpRequest<T> {
  constructor(
    public method: string,
    public url: string,
    public body?: T | null,
    public options?: any,
  ) {}
  clone(update?: any): HttpRequest<T> {
    return new HttpRequest(this.method, this.url, this.body, { ...this.options, ...update });
  }
}

export class HttpResponse<T> {
  constructor(
    public body: T | null,
    public status: number = 200,
    public statusText: string = 'OK',
    public headers?: any,
  ) {}
}

export class HttpErrorResponse extends Error {
  constructor(
    public error: any,
    public status: number = 0,
    public statusText: string = '',
    public headers?: any,
  ) {
    super();
    this.name = 'HttpErrorResponse';
  }
}

export type HttpHandlerFn = (req: HttpRequest<unknown>) => Observable<any>;
export type HttpEvent<T> = HttpResponse<T> | HttpErrorResponse;

export class HttpClient {
  request(_method: string, _url: string, _options?: any): Observable<any> {
    return of(new HttpResponse(null, 200));
  }
}
