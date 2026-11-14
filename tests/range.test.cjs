const {test} = require('node:test');
const assert = require('node:assert/strict');
const bounds = require('../mobile/range.js');
test('video ranges include closed, open, suffix, and clipped ranges',()=>{
  assert.deepEqual(bounds('bytes=10-19',100),[10,19]);
  assert.deepEqual(bounds('bytes=10-',100),[10,99]);
  assert.deepEqual(bounds('bytes=-10',100),[90,99]);
  assert.deepEqual(bounds('bytes=90-200',100),[90,99]);
  for (const range of ['bytes=100-','bytes=20-10','bytes=-0','bytes=','bytes=1-2,5-6','bytes=-','bytes=999999999999999999999-']) {
    assert.equal(bounds(range,100),null,range);
  }
});
