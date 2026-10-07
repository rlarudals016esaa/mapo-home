import {integer,sqliteTable,text} from 'drizzle-orm/sqlite-core';
export const administrators=sqliteTable('administrators',{slot:integer('slot').primaryKey(),userId:text('user_id').notNull()});
export const workspace=sqliteTable('admin_workspace',{id:text('id').primaryKey(),revision:integer('revision').notNull(),payload:text('payload').notNull()});
export const eventBatches=sqliteTable('admin_event_batches',{id:text('id').primaryKey(),payload:text('payload').notNull(),createdAt:text('created_at').notNull()});

export const integrationNonces=sqliteTable("integration_nonces",{id:text("id").primaryKey(),expiresAt:integer("expires_at").notNull()});
export const integrationStatus=sqliteTable("integration_status",{id:text("id").primaryKey(),payload:text("payload").notNull()});
export const catalogExports=sqliteTable("catalog_exports",{sequence:integer("sequence").primaryKey(),version:text("version").notNull().unique(),payload:text("payload").notNull()});
