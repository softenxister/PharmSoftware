const LEGACY_SSL_MODE = /([?&])sslmode=(?:prefer|require|verify-ca)(?=&|$)/i;

export function normalizePostgresConnectionString(connectionString: string): string {
  if (/[?&]uselibpqcompat=true(?:&|$)/i.test(connectionString)) return connectionString;
  return connectionString.replace(LEGACY_SSL_MODE, "$1sslmode=verify-full");
}
