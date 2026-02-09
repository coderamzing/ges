-- Set dispatcher for specific IDs
UPDATE "tp_status"
SET
    "types" = 'dispatcher'
WHERE
    id IN (16, 17, 18);

-- Set talent,dispatcher for all other records
UPDATE "tp_status"
SET
    "types" = 'talent,dispatcher'
WHERE
    id NOT IN(16, 17, 18);