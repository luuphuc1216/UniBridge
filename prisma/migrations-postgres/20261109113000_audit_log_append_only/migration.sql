CREATE OR REPLACE FUNCTION prevent_audit_log_mutation()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    RAISE EXCEPTION 'AuditLog is append-only';
END;
$$;

CREATE TRIGGER "AuditLog_no_update"
BEFORE UPDATE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER "AuditLog_no_delete"
BEFORE DELETE ON "AuditLog"
FOR EACH ROW
EXECUTE FUNCTION prevent_audit_log_mutation();

CREATE TRIGGER "AuditLog_no_truncate"
BEFORE TRUNCATE ON "AuditLog"
FOR EACH STATEMENT
EXECUTE FUNCTION prevent_audit_log_mutation();
