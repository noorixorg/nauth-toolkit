# @nauth-toolkit/database-typeorm-postgres

PostgreSQL database adapter for [nauth-toolkit](https://nauth.dev).

Implements the nauth-toolkit storage interface using TypeORM with PostgreSQL. Provides entity definitions, repositories, and migrations for all auth-related tables — users, sessions, MFA devices, audit logs, and more.

Plug this into your existing TypeORM `DataSource` and nauth-toolkit manages the rest.

**Docs:** [nauth.dev](https://nauth.dev) · **Examples:** [github.com/noorixorg/nauth](https://github.com/noorixorg/nauth) · **Live demo:** [demo.nauth.dev](https://demo.nauth.dev)
