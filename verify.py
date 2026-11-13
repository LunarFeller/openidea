from pathlib import Path
from decimal import Decimal, localcontext
import json
import sqlite3
import struct

root = Path(__file__).resolve().parent
with sqlite3.connect(":memory:") as db:
    db.executescript((root / "reproduce.sql").read_text())
    expected = [{"big_id": n, "precise": p, "note": t} for n, p, t in db.execute(
        "SELECT big_id, precise, note FROM exact_numbers ORDER BY position"
    )]
cases = json.loads((root / "decimal-cases.json").read_text())
report = {}
for stage in ("before", "after"):
    text = (root / f"{stage}-export.json").read_text()
    rows = json.loads(text, parse_float=Decimal)
    mismatches = [
        {"row": i, "expected": e["big_id"], "actual": a["big_id"]}
        for i, (a, e) in enumerate(zip(rows, expected)) if a != e
    ]
    assert len(rows) == len(expected)
    assert (root / f"{stage}-clipboard.json").read_text() == text
    if stage == "after":
        assert rows == expected
        assert (root / "after-quick-copy.json").read_text() == text
    decimals = json.loads((root / f"{stage}-decimal-fixture.json").read_text(), parse_float=Decimal)
    assert len(decimals) == len(cases)
    failures = []
    with localcontext() as ctx:
        ctx.prec = 200
        for i, (c, a) in enumerate(zip(cases, decimals)):
            target = Decimal(c["coefficient"]).scaleb(c["exponent"] - c["scale"])
            value = a["value"]
            if not isinstance(value, (int, Decimal)) or Decimal(value) != target:
                failures.append(i)
    if stage == "after":
        assert not failures
    report[stage] = {
        "sqlite_rows": len(rows), "mismatches": mismatches,
        "independent_decimal_fixture": {"total": len(cases), "passed": len(cases) - len(failures), "failed": len(failures)},
        "screenshot_size": struct.unpack(">II", (root / f"{stage}.png").read_bytes()[16:24]),
    }
assert report["before"]["mismatches"]
assert report["before"]["independent_decimal_fixture"]["failed"] > 0
assert report["before"]["screenshot_size"] == report["after"]["screenshot_size"]
print(json.dumps(report, indent=2))
