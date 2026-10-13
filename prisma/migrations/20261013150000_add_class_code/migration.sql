ALTER TABLE "classes" ADD COLUMN "code" TEXT;
CREATE UNIQUE INDEX "classes_code_key" ON "classes"("code");
