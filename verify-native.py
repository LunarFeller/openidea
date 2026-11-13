from decimal import Decimal, localcontext
from pathlib import Path
import json

ROOT = Path(__file__).parent


def read(phase, name):
    report = json.loads((ROOT / f"native-{phase}-{name}.json").read_text())
    assert report["success"], report
    return report["data"]


def decode(text):
    return json.loads(text, parse_float=Decimal)


def check_phase(phase):
    checks = {}
    controls = {}
    with localcontext() as context:
        context.prec = 1000
        for name in ["aggregates", "decimals", "bounds"]:
            if name == "aggregates":
                source = read(phase, "init")["outcomes"]
                ui = read(phase, name)
            else:
                fixture = read(phase, name)
                source, ui = fixture["outcomes"], fixture["ui"]
            values = sorted(Decimal(row[0]) for row in source[0]["result"]["rows"])
            assert len(values) == 2
            rows = dict(ui["rows"])
            expected = {"Sum": sum(values), "Avg": sum(values) / 2, "Median": sum(values) / 2}
            for key, value in expected.items():
                checks[f"{name}.{key}"] = Decimal(rows[key]) == value
            controls[f"{name}.source-retained"] = Decimal(rows["Min"]) == values[0] and Decimal(rows["Max"]) == values[-1]

    checks["chart.mean"] = "same: 0.5" in read(phase, "chart")["titles"]
    options = read(phase, "chart-options")
    checks["chart.sum"] = "same: 1" in options["sumTitles"]
    checks["chart.line"] = "same: 1" in options["lineTitles"]
    expected = {"id": 9007199254740993, "amount": Decimal("1.0000000000000000002"), "tiny": Decimal("1e-400")}
    http = read(phase, "http")
    controls["http.raw-received"] = decode(http["exchange"]["response"]["body"]) == expected
    formatted = decode(http["formatted"])
    for key, value in expected.items():
        checks[f"http.formatted.{key}"] = formatted[key] == value
    graphql = read(phase, "graphql")
    response = next(decode(text) for text in graphql["formatted"] if '"data"' in text)["data"]
    for key, value in expected.items():
        checks[f"graphql.formatted.{key}"] = response[key] == value
    wires = json.loads((ROOT / f"native-{phase}-wire.json").read_text())
    outgoing = next(decode(entry["body"])["variables"] for entry in reversed(wires) if entry["path"] == "/graphql" and '"variables"' in entry["body"])
    for key, value in expected.items():
        checks[f"graphql.wire.{key}"] = outgoing[key] == value
    environment = next(decode(entry["body"]) for entry in reversed(wires) if entry["path"] == "/env")
    expected["id"] = 123456789012345678901234567890
    for key, value in expected.items():
        checks[f"environment.wire.{key}"] = environment[key] == value
    controls["environment.request-matches-wire"] = decode(read(phase, "environment")["exchange"]["request"]["body"]) == environment
    return {"checks": checks, "controls": controls}


before, after = check_phase("before"), check_phase("after")
assert all(before["controls"].values()), before
assert all(after["controls"].values()), after
assert not any(before["checks"].values()), before
assert all(after["checks"].values()), after
result = {"method": "Python integer/Decimal oracle on real SQLite query values, rendered UI text and local server request bytes", "before": before, "after": after}
(ROOT / "native-verification.json").write_text(json.dumps(result, indent=2) + "\n")
print(json.dumps({"before_wrong_fields": len(before["checks"]), "after_correct_fields": len(after["checks"]), "controls_passed_each_phase": len(after["controls"])}))
