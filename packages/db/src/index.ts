export type DatabaseDialect = 'postgresql' | 'postgres' | 'sqlite';

export interface DatabaseConfig {
  dialect: DatabaseDialect;
  host: string;
  port: number;
  database: string;
  username: string;
  password: string;
}

export const databaseConfig: DatabaseConfig = {
  dialect: 'postgresql',
  host: process.env.DB_HOST || 'localhost',
  port: Number(process.env.DB_PORT || 5432),
  database: process.env.DB_NAME || 'streetsetu',
  username: process.env.DB_USER || 'streetsetu',
  password: process.env.DB_PASSWORD || 'streetsetu'
};
