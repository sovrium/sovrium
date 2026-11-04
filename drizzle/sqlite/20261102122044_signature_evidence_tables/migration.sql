CREATE TABLE `system_signature_challenges` (
	`id` text PRIMARY KEY,
	`signer_id` text NOT NULL,
	`channel` text NOT NULL,
	`code_hmac` text NOT NULL,
	`attempts` integer DEFAULT 0 NOT NULL,
	`expires_at` integer NOT NULL,
	`consumed_at` integer,
	`document_hash` text,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_system_signature_challenges_signer_id_system_signature_signers_id_fk` FOREIGN KEY (`signer_id`) REFERENCES `system_signature_signers`(`id`),
	CONSTRAINT "signature_challenges_channel_check" CHECK("channel" IN ('email', 'sms'))
);
--> statement-breakpoint
CREATE TABLE `system_signature_evidence` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL,
	`seq` integer NOT NULL,
	`event_type` text NOT NULL,
	`canonical_bytes` blob NOT NULL,
	`previous_hash` text,
	`hash` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_system_signature_evidence_request_id_system_signature_requests_id_fk` FOREIGN KEY (`request_id`) REFERENCES `system_signature_requests`(`id`)
);
--> statement-breakpoint
CREATE TABLE `system_signature_requests` (
	`id` text PRIMARY KEY,
	`flow_name` text NOT NULL,
	`table_name` text NOT NULL,
	`record_id` text NOT NULL,
	`status` text DEFAULT 'pending' NOT NULL,
	`signing_order` text NOT NULL,
	`statements` text NOT NULL,
	`document_hash` text,
	`document_key` text,
	`sealed_document_key` text,
	`proof_key` text,
	`created_at` integer NOT NULL,
	`expires_at` integer,
	`completed_at` integer,
	`keep_until` integer,
	`seal_level` text DEFAULT 'none' NOT NULL,
	`last_error` text,
	CONSTRAINT "signature_requests_status_check" CHECK("status" IN ('pending', 'signing', 'sealing', 'completed', 'declined', 'cancelled', 'expired')),
	CONSTRAINT "signature_requests_seal_level_check" CHECK("seal_level" IN ('none', 'b-b', 'b-t'))
);
--> statement-breakpoint
CREATE TABLE `system_signature_signers` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL,
	`signer_name` text NOT NULL,
	`position` integer NOT NULL,
	`status` text DEFAULT 'waiting' NOT NULL,
	`token_hash` text,
	`token_expires_at` integer,
	`field_name` text,
	`placement` text,
	`delivered_at` integer,
	`last_notified_at` integer,
	`signed_at` integer,
	`identity_kind` text NOT NULL,
	`user_id` text,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_system_signature_signers_request_id_system_signature_requests_id_fk` FOREIGN KEY (`request_id`) REFERENCES `system_signature_requests`(`id`),
	CONSTRAINT `fk_system_signature_signers_user_id_auth_user_id_fk` FOREIGN KEY (`user_id`) REFERENCES `auth_user`(`id`) ON DELETE SET NULL,
	CONSTRAINT "signature_signers_status_check" CHECK("status" IN ('waiting', 'invited', 'verified', 'signed', 'declined'))
);
--> statement-breakpoint
CREATE TABLE `system_signature_subjects` (
	`id` text PRIMARY KEY,
	`request_id` text NOT NULL,
	`signer_id` text NOT NULL,
	`name` text,
	`email` text,
	`phone` text,
	`ip_address` text,
	`user_agent` text,
	`reason` text,
	`salts` text NOT NULL,
	`created_at` integer NOT NULL,
	CONSTRAINT `fk_system_signature_subjects_request_id_system_signature_requests_id_fk` FOREIGN KEY (`request_id`) REFERENCES `system_signature_requests`(`id`),
	CONSTRAINT `fk_system_signature_subjects_signer_id_system_signature_signers_id_fk` FOREIGN KEY (`signer_id`) REFERENCES `system_signature_signers`(`id`)
);
--> statement-breakpoint
CREATE INDEX `signature_challenges_signer_idx` ON `system_signature_challenges` (`signer_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `signature_evidence_request_seq_unique` ON `system_signature_evidence` (`request_id`,`seq`);--> statement-breakpoint
CREATE INDEX `signature_requests_record_idx` ON `system_signature_requests` (`table_name`,`record_id`);--> statement-breakpoint
CREATE INDEX `signature_requests_status_idx` ON `system_signature_requests` (`status`);--> statement-breakpoint
CREATE INDEX `signature_requests_keep_until_idx` ON `system_signature_requests` (`keep_until`);--> statement-breakpoint
CREATE INDEX `signature_signers_request_idx` ON `system_signature_signers` (`request_id`);--> statement-breakpoint
CREATE UNIQUE INDEX `signature_signers_request_position_unique` ON `system_signature_signers` (`request_id`,`position`);--> statement-breakpoint
CREATE UNIQUE INDEX `signature_signers_token_hash_unique` ON `system_signature_signers` (`token_hash`);--> statement-breakpoint
CREATE INDEX `signature_signers_user_idx` ON `system_signature_signers` (`user_id`);--> statement-breakpoint
CREATE INDEX `signature_subjects_request_idx` ON `system_signature_subjects` (`request_id`);--> statement-breakpoint
CREATE INDEX `signature_subjects_signer_idx` ON `system_signature_subjects` (`signer_id`);--> statement-breakpoint
-- Evidence guards, the SQLite twin of the PostgreSQL migration's functions
-- (read the rules there). Hand-written below the generated DDL: drizzle-kit
-- does not model triggers. SQLite has no session variable to grant an
-- exemption, so each rule is the trigger's WHEN clause, and a write that
-- matches it aborts. Timestamps are epoch milliseconds.
CREATE TRIGGER `signature_requests_guard_update` BEFORE UPDATE ON `system_signature_requests`
WHEN NEW.`id` IS NOT OLD.`id`
  OR NEW.`flow_name` IS NOT OLD.`flow_name`
  OR NEW.`table_name` IS NOT OLD.`table_name`
  OR NEW.`record_id` IS NOT OLD.`record_id`
  OR NEW.`signing_order` IS NOT OLD.`signing_order`
  OR NEW.`statements` IS NOT OLD.`statements`
  OR NEW.`created_at` IS NOT OLD.`created_at`
  OR (OLD.`document_hash` IS NOT NULL AND NEW.`document_hash` IS NOT OLD.`document_hash`)
  OR (OLD.`document_key` IS NOT NULL AND NEW.`document_key` IS NOT OLD.`document_key`)
  OR (OLD.`sealed_document_key` IS NOT NULL AND NEW.`sealed_document_key` IS NOT OLD.`sealed_document_key`)
  OR (OLD.`proof_key` IS NOT NULL AND NEW.`proof_key` IS NOT OLD.`proof_key`)
  OR (OLD.`completed_at` IS NOT NULL AND NEW.`completed_at` IS NOT OLD.`completed_at`)
  OR (OLD.`keep_until` IS NOT NULL AND NEW.`keep_until` IS NOT OLD.`keep_until`)
  OR (OLD.`status` IN ('completed', 'declined', 'cancelled', 'expired') AND (
    NEW.`status` IS NOT OLD.`status`
    OR NEW.`seal_level` IS NOT OLD.`seal_level`
    OR NEW.`last_error` IS NOT OLD.`last_error`
    OR NEW.`expires_at` IS NOT OLD.`expires_at`))
BEGIN
  SELECT RAISE(ABORT, 'signature evidence is immutable: refused update of system_signature_requests');
END;
--> statement-breakpoint
CREATE TRIGGER `signature_signers_guard_update` BEFORE UPDATE ON `system_signature_signers`
WHEN NEW.`id` IS NOT OLD.`id`
  OR NEW.`request_id` IS NOT OLD.`request_id`
  OR NEW.`signer_name` IS NOT OLD.`signer_name`
  OR NEW.`position` IS NOT OLD.`position`
  OR NEW.`field_name` IS NOT OLD.`field_name`
  OR NEW.`placement` IS NOT OLD.`placement`
  OR NEW.`identity_kind` IS NOT OLD.`identity_kind`
  OR NEW.`created_at` IS NOT OLD.`created_at`
  OR (OLD.`signed_at` IS NOT NULL AND NEW.`signed_at` IS NOT OLD.`signed_at`)
  OR (OLD.`user_id` IS NOT NULL AND NEW.`user_id` IS NOT NULL AND NEW.`user_id` IS NOT OLD.`user_id`)
  OR (OLD.`status` IN ('signed', 'declined') AND NEW.`status` IS NOT OLD.`status`)
BEGIN
  SELECT RAISE(ABORT, 'signature evidence is immutable: refused update of system_signature_signers');
END;
--> statement-breakpoint
CREATE TRIGGER `signature_challenges_guard_update` BEFORE UPDATE ON `system_signature_challenges`
WHEN NEW.`id` IS NOT OLD.`id`
  OR NEW.`signer_id` IS NOT OLD.`signer_id`
  OR NEW.`channel` IS NOT OLD.`channel`
  OR NEW.`code_hmac` IS NOT OLD.`code_hmac`
  OR NEW.`expires_at` IS NOT OLD.`expires_at`
  OR NEW.`document_hash` IS NOT OLD.`document_hash`
  OR NEW.`created_at` IS NOT OLD.`created_at`
  OR NEW.`attempts` < OLD.`attempts`
  OR (OLD.`consumed_at` IS NOT NULL AND NEW.`consumed_at` IS NOT OLD.`consumed_at`)
BEGIN
  SELECT RAISE(ABORT, 'signature evidence is immutable: refused update of system_signature_challenges');
END;
--> statement-breakpoint
CREATE TRIGGER `signature_evidence_refuse_update` BEFORE UPDATE ON `system_signature_evidence`
BEGIN
  SELECT RAISE(ABORT, 'signature evidence is append-only: refused update of system_signature_evidence');
END;
--> statement-breakpoint
CREATE TRIGGER `signature_subjects_refuse_update` BEFORE UPDATE ON `system_signature_subjects`
BEGIN
  SELECT RAISE(ABORT, 'signature evidence is append-only: refused update of system_signature_subjects');
END;
--> statement-breakpoint
CREATE TRIGGER `signature_evidence_guard_delete` BEFORE DELETE ON `system_signature_evidence`
WHEN NOT EXISTS (
  SELECT 1 FROM `system_signature_requests` AS r
  WHERE r.`id` = OLD.`request_id` AND r.`keep_until` IS NOT NULL
    AND r.`keep_until` < CAST((julianday('now') - 2440587.5) * 86400000 AS INTEGER)
)
BEGIN
  SELECT RAISE(ABORT, 'signature evidence is kept until its keep date: refused delete from system_signature_evidence');
END;
