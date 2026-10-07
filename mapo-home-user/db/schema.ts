import {sqliteTable,text,integer} from "drizzle-orm/sqlite-core";
export const workspaces=sqliteTable("workspaces",{id:text("id").primaryKey(),revision:integer("revision").notNull().default(0),payload:text("payload").notNull()});
export const publicHousing=sqliteTable("public_housing",{id:text("id").primaryKey(),revision:integer("revision").notNull().default(0),payload:text("payload").notNull()});

export const integrationNonces=sqliteTable("integration_nonces",{id:text("id").primaryKey(),expiresAt:integer("expires_at").notNull()});
export const integrationStatus=sqliteTable("integration_status",{id:text("id").primaryKey(),payload:text("payload").notNull()});
export const sharedCatalog=sqliteTable("shared_catalog",{sequence:integer("sequence").primaryKey(),version:text("version").notNull().unique(),payload:text("payload").notNull()});
