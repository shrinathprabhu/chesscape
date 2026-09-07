import {
  sqliteTable,
  text,
  integer,
  uniqueIndex,
  index,
} from 'drizzle-orm/sqlite-core';
export const daily = sqliteTable('daily', {
  day: text('day').primaryKey(),
  fen: text('fen').notNull(),
  answers: text('answers').notNull(),
  source: text('source').notNull(),
  sourceId: text('source_id'),
  escapeCount: integer('escape_count').notNull(),
});
export const attempts = sqliteTable(
  'attempts',
  {
    id: text('id').primaryKey(),
    client: text('client').notNull(),
    day: text('day').notNull(),
    startedAt: integer('started_at').notNull(),
    expiresAt: integer('expires_at').notNull(),
    status: text('status').notNull().default('playing'),
    elapsedMs: integer('elapsed_ms'),
    move: text('move'),
    resultFen: text('result_fen'),
    reply: text('reply'),
  },
  (table) => [
    uniqueIndex('idx_attempts_client_day').on(table.client, table.day),
    index('idx_attempts_day').on(table.day),
  ],
);
export const rateLimits = sqliteTable('rate_limits', {
  key: text('key').primaryKey(),
  count: integer('count').notNull(),
  expires: integer('expires').notNull(),
});
