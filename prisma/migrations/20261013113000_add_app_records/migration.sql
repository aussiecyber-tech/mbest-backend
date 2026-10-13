CREATE TABLE "app_records" (
    "id" TEXT NOT NULL,
    "kind" TEXT NOT NULL,
    "owner_id" TEXT,
    "data" JSONB NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "app_records_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "app_records_kind_idx" ON "app_records"("kind");
CREATE INDEX "app_records_owner_id_idx" ON "app_records"("owner_id");
