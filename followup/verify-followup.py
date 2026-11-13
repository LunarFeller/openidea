from pathlib import Path
from decimal import Decimal
import json,gzip,hashlib
root=Path(__file__).parent
before=json.loads((root/'native-before-large.json').read_text())['data']
after=json.loads((root/'native-after-large.json').read_text())['data']
assert before['variableCharacters']==after['variableCharacters']==3000089
assert before['statePreservesInput'] and after['statePreservesInput']
assert 'unresolved variable(s): host' in before['result']['error']
assert before['result']['status'] is None
assert after['result']['status']==200 and after['result']['error'] is None
records=[json.loads(line) for line in gzip.decompress((root/'native-large-wire.jsonl.gz').read_bytes()).decode().splitlines()]
wire=next(json.loads(r['body'],parse_float=Decimal) for r in records if r['path']=='/graphql' and '"message"' in r['body'])
variables=wire['variables']
assert variables['id']==9007199254740993
assert variables['amount']==Decimal('1.0000000000000000002')
assert variables['tiny']==Decimal('1e-400')
assert variables['message']=='A'*500000+'{{host}}'
assert hashlib.sha256(variables['message'].encode()).hexdigest()==json.loads((root/'native-large-verification.json').read_text())['message_sha256']
response=json.loads(after['result']['body'],parse_float=Decimal)['data']
assert all(response[k]==variables[k] for k in ['id','amount','tiny'])
web=json.loads((root/'graphql-webkit-regression.json').read_text())
assert web['before'][1]['ours']['templatesRemain']
assert all(not r['ours']['templatesRemain'] and r['ours']['semantics'] and r['ours']['exactId'] and r['ours']['exactAmount'] and r['ours']['exactTiny'] for r in web['after'])
print('Verified real native request: before rejected; after200,exact numbers and unchanged literal template string. WebKit checks pass at all five sizes.')
