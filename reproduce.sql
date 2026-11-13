BEGIN TRANSACTION;
CREATE TABLE exact_numbers (position INTEGER, big_id INTEGER, precise TEXT, note TEXT);
INSERT INTO "exact_numbers" VALUES(1,9223372036854775807,'1.0000000000000000002','maximum 64-bit integer');
INSERT INTO "exact_numbers" VALUES(2,-9223372036854775808,'-1.0000000000000000002','minimum 64-bit integer');
INSERT INTO "exact_numbers" VALUES(3,9007199254740993,'0.0000000000000000001','adjacent integer above 2^53');
COMMIT;

SELECT big_id, precise, note FROM exact_numbers ORDER BY position;
