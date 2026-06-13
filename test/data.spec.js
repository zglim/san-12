/**
 * @file Data 单元测试
 */

/* globals san */

// DataChangeType 枚举值与 src/runtime/data-change-type.js 保持一致
var SET = 1;
var SPLICE = 2;

describe('Data API', function () {

    // ---- set / get ----
    describe('set / get', function () {

        it('set and get a simple value', function () {
            var d = new san.Data({name: 'san'});
            expect(d.get('name')).toBe('san');

            d.set('name', 'erik');
            expect(d.get('name')).toBe('erik');
        });

        it('set a deep path', function () {
            var d = new san.Data({a: {b: {c: 1}}});
            d.set('a.b.c', 99);
            expect(d.get('a.b.c')).toBe(99);
        });

        it('set creates intermediate objects on null', function () {
            var d = new san.Data({});
            d.set('x.y', 10);
            expect(d.get('x.y')).toBe(10);
        });

        it('set skips when value is identical (no force)', function () {
            var d = new san.Data({v: 1});
            var fired = false;
            d.listen(function () { fired = true; });
            d.set('v', 1);
            expect(fired).toBe(false);
        });

        it('set fires when value is identical with force option', function () {
            var d = new san.Data({v: 1});
            var fired = false;
            d.listen(function () { fired = true; });
            d.set('v', 1, {force: true});
            expect(fired).toBe(true);
        });

        it('set with expression object', function () {
            var d = new san.Data({a: {b: 1}});
            var expr = {
                type: 4, // ACCESSOR
                paths: [
                    {type: 1, value: 'a'},
                    {type: 1, value: 'b'}
                ]
            };
            d.set(expr, 42);
            expect(d.get('a.b')).toBe(42);
        });

        it('set does not mutate original nested object', function () {
            var obj = {x: 1};
            var d = new san.Data({a: obj});
            d.set('a.x', 2);
            // immutable: original obj should be untouched
            expect(obj.x).toBe(1);
            expect(d.get('a.x')).toBe(2);
        });

    });

    // ---- assign ----
    describe('assign', function () {

        it('batch set top-level keys', function () {
            var d = new san.Data({a: 1, b: 2});
            d.assign({a: 10, c: 30});
            expect(d.get('a')).toBe(10);
            expect(d.get('b')).toBe(2);
            expect(d.get('c')).toBe(30);
        });

        it('assign respects silent option', function () {
            var d = new san.Data({a: 1});
            var count = 0;
            d.listen(function () { count++; });
            d.assign({a: 2, b: 3}, {silent: true});
            expect(count).toBe(0);
            expect(d.get('a')).toBe(2);
        });

    });

    // ---- merge ----
    describe('merge', function () {

        it('merge object properties into existing target', function () {
            var d = new san.Data({p: {x: 1, y: 2}});
            d.merge('p', {y: 20, z: 30});
            expect(d.get('p.x')).toBe(1);
            expect(d.get('p.y')).toBe(20);
            expect(d.get('p.z')).toBe(30);
        });

        it('merge fires change events for each key', function () {
            var d = new san.Data({p: {x: 1}});
            var events = [];
            d.listen(function (e) { events.push(e); });
            d.merge('p', {x: 10, y: 20});
            expect(events.length).toBe(2);
        });

    });

    // ---- apply ----
    describe('apply', function () {

        it('apply transforms existing value via function', function () {
            var d = new san.Data({count: 5});
            d.apply('count', function (v) { return v + 1; });
            expect(d.get('count')).toBe(6);
        });

        it('apply passes old value to fn', function () {
            var d = new san.Data({s: 'hello'});
            d.apply('s', function (v) { return v.toUpperCase(); });
            expect(d.get('s')).toBe('HELLO');
        });

    });

    // ---- splice ----
    describe('splice', function () {

        it('splice remove items', function () {
            var d = new san.Data({list: [1, 2, 3, 4]});
            var removed = d.splice('list', [1, 2]);
            expect(removed).toEqual([2, 3]);
            expect(d.get('list')).toEqual([1, 4]);
        });

        it('splice insert items', function () {
            var d = new san.Data({list: [1, 4]});
            d.splice('list', [1, 0, 2, 3]);
            expect(d.get('list')).toEqual([1, 2, 3, 4]);
        });

        it('splice with negative index', function () {
            var d = new san.Data({list: [1, 2, 3]});
            d.splice('list', [-1, 1]);
            expect(d.get('list')).toEqual([1, 2]);
        });

        it('splice with negative index exceeding length clamps to 0', function () {
            var d = new san.Data({list: [1, 2, 3]});
            d.splice('list', [-100, 1]);
            expect(d.get('list')).toEqual([2, 3]);
        });

        it('splice with index beyond length clamps to length', function () {
            var d = new san.Data({list: [1, 2]});
            d.splice('list', [100, 0, 3]);
            expect(d.get('list')).toEqual([1, 2, 3]);
        });

        it('splice fires SPLICE event with correct fields', function () {
            var d = new san.Data({list: [10, 20, 30]});
            var event;
            d.listen(function (e) { event = e; });
            d.splice('list', [1, 1, 99]);
            expect(event).toBeDefined();
            expect(event.type).toBe(SPLICE);
            expect(event.index).toBe(1);
            expect(event.deleteCount).toBe(1);
            expect(event.insertions).toEqual([99]);
            expect(event.value).toEqual([20]);
        });

        it('splice on non-array does nothing', function () {
            var d = new san.Data({val: 'hello'});
            var removed = d.splice('val', [0, 1]);
            expect(removed).toEqual([]);
        });

    });

    // ---- push ----
    describe('push', function () {

        it('push item to end of array', function () {
            var d = new san.Data({list: [1, 2]});
            var len = d.push('list', 3);
            expect(len).toBe(3);
            expect(d.get('list')).toEqual([1, 2, 3]);
        });

        it('push on non-array returns undefined', function () {
            var d = new san.Data({val: 'str'});
            var result = d.push('val', 1);
            expect(result).toBeUndefined();
        });

    });

    // ---- pop ----
    describe('pop', function () {

        it('pop removes last item', function () {
            var d = new san.Data({list: [1, 2, 3]});
            var item = d.pop('list');
            expect(item).toBe(3);
            expect(d.get('list')).toEqual([1, 2]);
        });

        it('pop on empty array returns undefined', function () {
            var d = new san.Data({list: []});
            var item = d.pop('list');
            expect(item).toBeUndefined();
            expect(d.get('list')).toEqual([]);
        });

        it('pop on non-array returns undefined', function () {
            var d = new san.Data({val: 'x'});
            expect(d.pop('val')).toBeUndefined();
        });

    });

    // ---- shift ----
    describe('shift', function () {

        it('shift removes first item', function () {
            var d = new san.Data({list: [10, 20, 30]});
            var item = d.shift('list');
            expect(item).toBe(10);
            expect(d.get('list')).toEqual([20, 30]);
        });

        it('shift on empty array returns undefined', function () {
            var d = new san.Data({list: []});
            var item = d.shift('list');
            expect(item).toBeUndefined();
        });

    });

    // ---- unshift ----
    describe('unshift', function () {

        it('unshift adds item to start', function () {
            var d = new san.Data({list: [2, 3]});
            var len = d.unshift('list', 1);
            expect(len).toBe(3);
            expect(d.get('list')).toEqual([1, 2, 3]);
        });

        it('unshift on non-array returns undefined', function () {
            var d = new san.Data({val: 0});
            expect(d.unshift('val', 1)).toBeUndefined();
        });

    });

    // ---- remove / removeAt ----
    describe('remove / removeAt', function () {

        it('remove removes last matching item by value', function () {
            var d = new san.Data({list: [1, 2, 3, 2]});
            d.remove('list', 2);
            expect(d.get('list')).toEqual([1, 2, 3]);
        });

        it('remove does nothing if value not found', function () {
            var d = new san.Data({list: [1, 2, 3]});
            var before = d.get('list').slice();
            d.remove('list', 99);
            expect(d.get('list')).toEqual(before);
        });

        it('removeAt removes item at index', function () {
            var d = new san.Data({list: ['a', 'b', 'c']});
            d.removeAt('list', 1);
            expect(d.get('list')).toEqual(['a', 'c']);
        });

        it('remove on non-array does nothing', function () {
            var d = new san.Data({val: 'str'});
            d.remove('val', 'str');
            // should not throw
            expect(d.get('val')).toBe('str');
        });

    });

    // ---- silent / silence / quiet options ----
    describe('silent options', function () {

        it('set with silent option does not fire', function () {
            var d = new san.Data({a: 1});
            var fired = false;
            d.listen(function () { fired = true; });
            d.set('a', 2, {silent: true});
            expect(fired).toBe(false);
            expect(d.get('a')).toBe(2);
        });

        it('set with silence option does not fire', function () {
            var d = new san.Data({a: 1});
            var fired = false;
            d.listen(function () { fired = true; });
            d.set('a', 3, {silence: true});
            expect(fired).toBe(false);
        });

        it('set with quiet option does not fire', function () {
            var d = new san.Data({a: 1});
            var fired = false;
            d.listen(function () { fired = true; });
            d.set('a', 4, {quiet: true});
            expect(fired).toBe(false);
        });

        it('splice with silent does not fire', function () {
            var d = new san.Data({list: [1, 2, 3]});
            var fired = false;
            d.listen(function () { fired = true; });
            d.splice('list', [0, 1], {silent: true});
            expect(fired).toBe(false);
            expect(d.get('list')).toEqual([2, 3]);
        });

        it('push with silent does not fire', function () {
            var d = new san.Data({list: [1]});
            var fired = false;
            d.listen(function () { fired = true; });
            d.push('list', 2, {silent: true});
            expect(fired).toBe(false);
        });

        it('merge with silent does not fire', function () {
            var d = new san.Data({p: {x: 1}});
            var fired = false;
            d.listen(function () { fired = true; });
            d.merge('p', {x: 10}, {silent: true});
            expect(fired).toBe(false);
            expect(d.get('p.x')).toBe(10);
        });

    });

    // ---- event shape / DataChangeType ----
    describe('event shape', function () {

        it('set event has correct type and fields', function () {
            var d = new san.Data({name: 'old'});
            var event;
            d.listen(function (e) { event = e; });
            d.set('name', 'new');
            expect(event.type).toBe(SET);
            expect(event.value).toBe('new');
            expect(event.expr).toBeDefined();
            expect(event.expr.paths[0].value).toBe('name');
        });

        it('splice event includes insertions', function () {
            var d = new san.Data({arr: [1, 2, 3]});
            var event;
            d.listen(function (e) { event = e; });
            d.splice('arr', [1, 1, 10, 20]);
            expect(event.type).toBe(SPLICE);
            expect(event.insertions).toEqual([10, 20]);
            expect(event.deleteCount).toBe(1);
            expect(event.value).toEqual([2]);
            expect(event.index).toBe(1);
        });

    });

    // ---- error branches (dev mode) ----
    describe('error branches', function () {

        it('set with invalid expression throws', function () {
            var d = new san.Data({a: 1});
            expect(function () {
                // a non-accessor expression (type BINARY = 8)
                d.set({type: 8, paths: []}, 1);
            }).toThrow();
        });

        it('merge with invalid expression throws', function () {
            var d = new san.Data({a: {}});
            expect(function () {
                d.merge({type: 8}, {x: 1});
            }).toThrow();
        });

        it('apply with invalid expression throws', function () {
            var d = new san.Data({a: 1});
            expect(function () {
                d.apply({type: 8}, function (v) { return v; });
            }).toThrow();
        });

        it('splice with invalid expression throws', function () {
            var d = new san.Data({a: []});
            expect(function () {
                d.splice({type: 8}, [0, 1]);
            }).toThrow();
        });

        it('merge on non-object target throws', function () {
            var d = new san.Data({a: 'string'});
            expect(function () {
                d.merge('a', {x: 1});
            }).toThrow();
        });

        it('merge with non-object source throws', function () {
            var d = new san.Data({a: {}});
            expect(function () {
                d.merge('a', 'not-an-object');
            }).toThrow();
        });

        it('apply with non-function fn throws', function () {
            var d = new san.Data({a: 1});
            expect(function () {
                d.apply('a', 'not-a-function');
            }).toThrow();
        });

    });

    // ---- listen / unlisten ----
    describe('listen / unlisten', function () {

        it('listen receives events', function () {
            var d = new san.Data({a: 1});
            var count = 0;
            var handler = function () { count++; };
            d.listen(handler);
            d.set('a', 2);
            d.set('a', 3);
            expect(count).toBe(2);
        });

        it('unlisten removes specific handler', function () {
            var d = new san.Data({a: 1});
            var count = 0;
            var handler = function () { count++; };
            d.listen(handler);
            d.set('a', 2);
            expect(count).toBe(1);
            d.unlisten(handler);
            d.set('a', 3);
            expect(count).toBe(1);
        });

        it('unlisten with no argument removes all', function () {
            var d = new san.Data({a: 1});
            var c1 = 0, c2 = 0;
            d.listen(function () { c1++; });
            d.listen(function () { c2++; });
            d.set('a', 2);
            expect(c1).toBe(1);
            expect(c2).toBe(1);
            d.unlisten();
            d.set('a', 3);
            expect(c1).toBe(1);
            expect(c2).toBe(1);
        });

    });

    // ---- parent Data ----
    describe('parent data fallback', function () {

        it('get falls back to parent when not found locally', function () {
            var parent = new san.Data({x: 100});
            var child = new san.Data({}, parent);
            expect(child.get('x')).toBe(100);
        });

        it('local value shadows parent', function () {
            var parent = new san.Data({x: 100});
            var child = new san.Data({x: 200}, parent);
            expect(child.get('x')).toBe(200);
        });

    });

    // ---- array immutability ----
    describe('immutability', function () {

        it('set on array element returns new array', function () {
            var arr = [1, 2, 3];
            var d = new san.Data({arr: arr});
            d.set('arr[1]', 20);
            var newArr = d.get('arr');
            expect(newArr).not.toBe(arr);
            expect(newArr).toEqual([1, 20, 3]);
            // original untouched
            expect(arr).toEqual([1, 2, 3]);
        });

        it('splice returns new array, original untouched', function () {
            var arr = [1, 2, 3];
            var d = new san.Data({arr: arr});
            d.splice('arr', [1, 1]);
            var newArr = d.get('arr');
            expect(newArr).not.toBe(arr);
            expect(newArr).toEqual([1, 3]);
            expect(arr).toEqual([1, 2, 3]);
        });

    });

});
