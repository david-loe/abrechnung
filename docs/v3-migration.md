# Migrating existing data to v3

Run the v3 setup against a backup copy before upgrading production. Keep the
original v2 backup until the migrated amounts, receipts and exports are verified.

## Recorded currency amounts

Old costs can contain either exchange-rate direction. Migration preserves their
recorded EUR amounts: it retains an already matching rate, otherwise derives EUR
per foreign-currency unit from the two recorded amounts. It does not fetch rates
or recalculate historical report summaries. Each report is updated atomically;
already converted positions are safe to revisit after an interrupted setup.

The migration checks the source costs before changing v3 report data. Contradictory
amounts that cannot be represented by a positive rate stop migration and identify
the document and field. Existing foreign costs without a recorded EUR amount are
preserved and listed as warnings; they must be reviewed separately and must not
be counted as successfully verified conversions.

For production-data rehearsals, mount the source volume read-only, use a separate
copy, disable all delivery configuration, run no worker, and isolate the database,
application and browser from external networks. Queued notification jobs are not
proof of delivery; verify that no job was executed and stop the test environment
when finished. Keep private snapshots and screenshots out of the repository.

Advance budget rates are normalized from their recorded foreign/EUR amounts too.
Balances and offsets are converted from the old EUR values into the budget currency
in the same atomic update as the budget rate. Their recorded EUR counterparts are
retained. A nonzero balance or offset without a usable recorded budget pair blocks
the migration before any report conversion; a rate alone is not sufficient evidence.

For advances whose recorded EUR balance and offsets sum to their recorded EUR budget,
migration reconciles a foreign-currency rounding difference of at most 0.01. A remaining
balance becomes the budget minus the converted offsets. An already spent advance stays
at zero, with the difference assigned to its last originally nonzero offset. Recorded
EUR amounts and the normalized exchange rate are retained. Larger differences or an
adjustment producing a negative amount stop the preflight before report conversion.
Unmatched EUR source totals are reported and converted without a rounding adjustment.

Legacy summary objects are converted to the current array shape for both current
and historical reports. Recorded totals are retained; the report project, base
currency and missing current fields are supplied without recalculating history.
