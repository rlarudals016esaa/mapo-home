import {sqliteTable,text,integer,index} from "drizzle-orm/sqlite-core";
export const workspaces=sqliteTable("workspaces",{id:text("id").primaryKey(),revision:integer("revision").notNull().default(0),payload:text("payload").notNull(),pushCommit:text("push_commit")});
export const publicHousing=sqliteTable("public_housing",{id:text("id").primaryKey(),revision:integer("revision").notNull().default(0),payload:text("payload").notNull()});

export const integrationNonces=sqliteTable("integration_nonces",{id:text("id").primaryKey(),expiresAt:integer("expires_at").notNull()});
export const integrationStatus=sqliteTable("integration_status",{id:text("id").primaryKey(),payload:text("payload").notNull()});
export const sharedCatalog=sqliteTable("shared_catalog",{sequence:integer("sequence").primaryKey(),version:text("version").notNull().unique(),payload:text("payload").notNull()});
export const pushSubscriptions=sqliteTable("push_subscriptions",{
  id:text("id").primaryKey(),userId:text("user_id").notNull(),payload:text("payload").notNull(),
  createdAt:text("created_at").notNull(),lastSeen:text("last_seen").notNull(),lastTest:integer("last_test").notNull().default(0),
},t=>[index("idx_push_subscriptions_user").on(t.userId)]);
export const pushOutbox=sqliteTable("push_outbox",{
  id:text("id").primaryKey(),userId:text("user_id").notNull(),subscriptionId:text("subscription_id").notNull(),payload:text("payload").notNull(),
  status:text("status").notNull().default("queued"),attempts:integer("attempts").notNull().default(0),
  nextAttempt:integer("next_attempt").notNull().default(0),lease:text("lease"),createdAt:integer("created_at").notNull(),
  acceptedAt:integer("accepted_at"),lastStatus:integer("last_status"),
},t=>[index("idx_push_outbox_due").on(t.status,t.nextAttempt),index("idx_push_outbox_user_device").on(t.userId,t.subscriptionId)]);
