CREATE TABLE "system"."signature_challenges" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"signer_id" text NOT NULL,
	"channel" text NOT NULL,
	"code_hmac" text NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"expires_at" timestamp with time zone NOT NULL,
	"consumed_at" timestamp with time zone,
	"document_hash" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signature_challenges_channel_check" CHECK ("channel" IN ('email', 'sms'))
);
--> statement-breakpoint
CREATE TABLE "system"."signature_evidence" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"request_id" text NOT NULL,
	"seq" integer NOT NULL,
	"event_type" text NOT NULL,
	"canonical_bytes" bytea NOT NULL,
	"previous_hash" text,
	"hash" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "system"."signature_requests" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"flow_name" text NOT NULL,
	"table_name" text NOT NULL,
	"record_id" text NOT NULL,
	"status" text DEFAULT 'pending' NOT NULL,
	"signing_order" text NOT NULL,
	"statements" jsonb NOT NULL,
	"document_hash" text,
	"document_key" text,
	"sealed_document_key" text,
	"proof_key" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"expires_at" timestamp with time zone,
	"completed_at" timestamp with time zone,
	"keep_until" timestamp with time zone,
	"seal_level" text DEFAULT 'none' NOT NULL,
	"last_error" text,
	CONSTRAINT "signature_requests_status_check" CHECK ("status" IN ('pending', 'signing', 'sealing', 'completed', 'declined', 'cancelled', 'expired')),
	CONSTRAINT "signature_requests_seal_level_check" CHECK ("seal_level" IN ('none', 'b-b', 'b-t'))
);
--> statement-breakpoint
CREATE TABLE "system"."signature_signers" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"request_id" text NOT NULL,
	"signer_name" text NOT NULL,
	"position" integer NOT NULL,
	"status" text DEFAULT 'waiting' NOT NULL,
	"token_hash" text,
	"token_expires_at" timestamp with time zone,
	"field_name" text,
	"placement" jsonb,
	"delivered_at" timestamp with time zone,
	"last_notified_at" timestamp with time zone,
	"signed_at" timestamp with time zone,
	"identity_kind" text NOT NULL,
	"user_id" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "signature_signers_status_check" CHECK ("status" IN ('waiting', 'invited', 'verified', 'signed', 'declined'))
);
--> statement-breakpoint
CREATE TABLE "system"."signature_subjects" (
	"id" text PRIMARY KEY DEFAULT gen_random_uuid(),
	"request_id" text NOT NULL,
	"signer_id" text NOT NULL,
	"name" text,
	"email" text,
	"phone" text,
	"ip_address" text,
	"user_agent" text,
	"reason" text,
	"salts" jsonb NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE INDEX "signature_challenges_signer_idx" ON "system"."signature_challenges" ("signer_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signature_evidence_request_seq_unique" ON "system"."signature_evidence" ("request_id","seq");--> statement-breakpoint
CREATE INDEX "signature_requests_record_idx" ON "system"."signature_requests" ("table_name","record_id");--> statement-breakpoint
CREATE INDEX "signature_requests_status_idx" ON "system"."signature_requests" ("status");--> statement-breakpoint
CREATE INDEX "signature_requests_keep_until_idx" ON "system"."signature_requests" ("keep_until");--> statement-breakpoint
CREATE INDEX "signature_signers_request_idx" ON "system"."signature_signers" ("request_id");--> statement-breakpoint
CREATE UNIQUE INDEX "signature_signers_request_position_unique" ON "system"."signature_signers" ("request_id","position");--> statement-breakpoint
CREATE UNIQUE INDEX "signature_signers_token_hash_unique" ON "system"."signature_signers" ("token_hash");--> statement-breakpoint
CREATE INDEX "signature_signers_user_idx" ON "system"."signature_signers" ("user_id");--> statement-breakpoint
CREATE INDEX "signature_subjects_request_idx" ON "system"."signature_subjects" ("request_id");--> statement-breakpoint
CREATE INDEX "signature_subjects_signer_idx" ON "system"."signature_subjects" ("signer_id");--> statement-breakpoint
ALTER TABLE "system"."signature_challenges" ADD CONSTRAINT "signature_challenges_signer_id_signature_signers_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "system"."signature_signers"("id");--> statement-breakpoint
ALTER TABLE "system"."signature_evidence" ADD CONSTRAINT "signature_evidence_request_id_signature_requests_id_fkey" FOREIGN KEY ("request_id") REFERENCES "system"."signature_requests"("id");--> statement-breakpoint
ALTER TABLE "system"."signature_signers" ADD CONSTRAINT "signature_signers_request_id_signature_requests_id_fkey" FOREIGN KEY ("request_id") REFERENCES "system"."signature_requests"("id");--> statement-breakpoint
ALTER TABLE "system"."signature_signers" ADD CONSTRAINT "signature_signers_user_id_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."user"("id") ON DELETE SET NULL;--> statement-breakpoint
ALTER TABLE "system"."signature_subjects" ADD CONSTRAINT "signature_subjects_request_id_signature_requests_id_fkey" FOREIGN KEY ("request_id") REFERENCES "system"."signature_requests"("id");--> statement-breakpoint
ALTER TABLE "system"."signature_subjects" ADD CONSTRAINT "signature_subjects_signer_id_signature_signers_id_fkey" FOREIGN KEY ("signer_id") REFERENCES "system"."signature_signers"("id");--> statement-breakpoint
-- Evidence guards. Hand-written below the generated DDL: drizzle-kit does not
-- model triggers. A signing flow only ever INSERTs into these tables, then
-- advances a few state columns; every other write is refused here, so a bug,
-- a raw query or a careless script cannot rewrite what a signer saw.
--
-- signature_requests: identity, target, statement, order and created_at
-- never change; document_hash, document_key, sealed_document_key, proof_key,
-- completed_at and keep_until are write-once (NULL to a value, then frozen);
-- status, seal_level, last_error and expires_at (a deadline the sender may
-- extend) move freely until status is terminal (completed, declined,
-- cancelled, expired), then freeze.
CREATE FUNCTION "system"."signature_requests_guard_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."flow_name" IS DISTINCT FROM OLD."flow_name"
    OR NEW."table_name" IS DISTINCT FROM OLD."table_name"
    OR NEW."record_id" IS DISTINCT FROM OLD."record_id"
    OR NEW."signing_order" IS DISTINCT FROM OLD."signing_order"
    OR NEW."statements" IS DISTINCT FROM OLD."statements"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
    OR (OLD."document_hash" IS NOT NULL AND NEW."document_hash" IS DISTINCT FROM OLD."document_hash")
    OR (OLD."document_key" IS NOT NULL AND NEW."document_key" IS DISTINCT FROM OLD."document_key")
    OR (OLD."sealed_document_key" IS NOT NULL AND NEW."sealed_document_key" IS DISTINCT FROM OLD."sealed_document_key")
    OR (OLD."proof_key" IS NOT NULL AND NEW."proof_key" IS DISTINCT FROM OLD."proof_key")
    OR (OLD."completed_at" IS NOT NULL AND NEW."completed_at" IS DISTINCT FROM OLD."completed_at")
    OR (OLD."keep_until" IS NOT NULL AND NEW."keep_until" IS DISTINCT FROM OLD."keep_until")
    OR (OLD."status" IN ('completed', 'declined', 'cancelled', 'expired') AND (
      NEW."status" IS DISTINCT FROM OLD."status"
      OR NEW."seal_level" IS DISTINCT FROM OLD."seal_level"
      OR NEW."last_error" IS DISTINCT FROM OLD."last_error"
      OR NEW."expires_at" IS DISTINCT FROM OLD."expires_at"))
  THEN
    RAISE EXCEPTION 'signature evidence is immutable: refused update of system.signature_requests %', OLD."id" USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "signature_requests_guard_update" BEFORE UPDATE ON "system"."signature_requests" FOR EACH ROW EXECUTE FUNCTION "system"."signature_requests_guard_update"();
--> statement-breakpoint
-- signature_signers: identity, request, name, position, field, placement,
-- identity kind and created_at never change; signed_at is write-once; user_id
-- may be set once and may be cleared (the account's deletion sets it NULL),
-- never repointed; token_hash, token_expires_at, delivered_at and
-- last_notified_at move freely
-- (a resend rotates the link); status freezes once signed or declined.
CREATE FUNCTION "system"."signature_signers_guard_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."request_id" IS DISTINCT FROM OLD."request_id"
    OR NEW."signer_name" IS DISTINCT FROM OLD."signer_name"
    OR NEW."position" IS DISTINCT FROM OLD."position"
    OR NEW."field_name" IS DISTINCT FROM OLD."field_name"
    OR NEW."placement" IS DISTINCT FROM OLD."placement"
    OR NEW."identity_kind" IS DISTINCT FROM OLD."identity_kind"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
    OR (OLD."signed_at" IS NOT NULL AND NEW."signed_at" IS DISTINCT FROM OLD."signed_at")
    OR (OLD."user_id" IS NOT NULL AND NEW."user_id" IS NOT NULL AND NEW."user_id" IS DISTINCT FROM OLD."user_id")
    OR (OLD."status" IN ('signed', 'declined') AND NEW."status" IS DISTINCT FROM OLD."status")
  THEN
    RAISE EXCEPTION 'signature evidence is immutable: refused update of system.signature_signers %', OLD."id" USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "signature_signers_guard_update" BEFORE UPDATE ON "system"."signature_signers" FOR EACH ROW EXECUTE FUNCTION "system"."signature_signers_guard_update"();
--> statement-breakpoint
-- signature_challenges: only attempts (never downwards) and consumed_at
-- (write-once) change.
CREATE FUNCTION "system"."signature_challenges_guard_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."id" IS DISTINCT FROM OLD."id"
    OR NEW."signer_id" IS DISTINCT FROM OLD."signer_id"
    OR NEW."channel" IS DISTINCT FROM OLD."channel"
    OR NEW."code_hmac" IS DISTINCT FROM OLD."code_hmac"
    OR NEW."expires_at" IS DISTINCT FROM OLD."expires_at"
    OR NEW."document_hash" IS DISTINCT FROM OLD."document_hash"
    OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
    OR NEW."attempts" < OLD."attempts"
    OR (OLD."consumed_at" IS NOT NULL AND NEW."consumed_at" IS DISTINCT FROM OLD."consumed_at")
  THEN
    RAISE EXCEPTION 'signature evidence is immutable: refused update of system.signature_challenges %', OLD."id" USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN NEW;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "signature_challenges_guard_update" BEFORE UPDATE ON "system"."signature_challenges" FOR EACH ROW EXECUTE FUNCTION "system"."signature_challenges_guard_update"();
--> statement-breakpoint
-- signature_evidence (the chain) and signature_subjects: no UPDATE, ever.
CREATE FUNCTION "system"."signature_refuse_update"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'signature evidence is append-only: refused update of system.%', TG_TABLE_NAME USING ERRCODE = 'restrict_violation';
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "signature_evidence_refuse_update" BEFORE UPDATE ON "system"."signature_evidence" FOR EACH ROW EXECUTE FUNCTION "system"."signature_refuse_update"();
--> statement-breakpoint
CREATE TRIGGER "signature_subjects_refuse_update" BEFORE UPDATE ON "system"."signature_subjects" FOR EACH ROW EXECUTE FUNCTION "system"."signature_refuse_update"();
--> statement-breakpoint
-- A chain row goes only once its request's keep_until has passed. A request
-- with no keep_until keeps its chain. signature_subjects stays deletable: the
-- erasure path and the keep sweep remove it.
CREATE FUNCTION "system"."signature_evidence_guard_delete"() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM "system"."signature_requests" AS r
    WHERE r."id" = OLD."request_id" AND r."keep_until" IS NOT NULL AND r."keep_until" < now()
  ) THEN
    RAISE EXCEPTION 'signature evidence is kept until its keep date: refused delete from system.signature_evidence %', OLD."id" USING ERRCODE = 'restrict_violation';
  END IF;
  RETURN OLD;
END;
$$;
--> statement-breakpoint
CREATE TRIGGER "signature_evidence_guard_delete" BEFORE DELETE ON "system"."signature_evidence" FOR EACH ROW EXECUTE FUNCTION "system"."signature_evidence_guard_delete"();
