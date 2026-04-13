import assert from 'node:assert/strict';
import { getReadOnlyQueryKeywordList, isReadOnlyQuery } from '../../app/api/utils/sql-readonly';

assert.equal(isReadOnlyQuery('SELECT * FROM orders'), true);
assert.equal(isReadOnlyQuery('WITH recent AS (SELECT 1) SELECT * FROM recent'), true);
assert.equal(isReadOnlyQuery('DESCRIBE orders'), true);
assert.equal(isReadOnlyQuery('desc orders'), true);
assert.equal(isReadOnlyQuery('PRAGMA table_info(orders);'), true);
assert.equal(isReadOnlyQuery('  pragma index_list(\'orders\');'), true);

assert.equal(isReadOnlyQuery('INSERT INTO orders VALUES (1)'), false);
assert.equal(isReadOnlyQuery('UPDATE orders SET status = 1'), false);
assert.equal(isReadOnlyQuery('DELETE FROM orders'), false);

assert.equal(getReadOnlyQueryKeywordList(), 'SELECT/SHOW/DESCRIBE/DESC/EXPLAIN/WITH/PRAGMA');
