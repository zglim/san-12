/**
 * 表达式解析器单元测试
 *
 * 覆盖：优先级、结合性、三元嵌套、call/accessor 混合、模板插值、边界情况
 * 运行：node test/parser-expr.spec.js
 */

var assert = require('assert');
var parseExpr = require('../src/parser/parse-expr');
var parseText = require('../src/parser/parse-text');
var ExprType = require('../src/parser/expr-type');

var passed = 0;
var failed = 0;

function test(name, fn) {
    try {
        fn();
        passed++;
    } catch (e) {
        failed++;
        console.error('FAIL: ' + name);
        console.error('  ' + e.message);
    }
}

// ============================================================
// 1. 基本算术运算
// ============================================================

test('addition: 1 + 2', function () {
    var r = parseExpr('1 + 2');
    assert.strictEqual(r.type, ExprType.BINARY);
    assert.strictEqual(r.operator, 43); // +
    assert.strictEqual(r.segs[0].type, ExprType.NUMBER);
    assert.strictEqual(r.segs[0].value, 1);
    assert.strictEqual(r.segs[1].value, 2);
});

test('subtraction: 5 - 3', function () {
    var r = parseExpr('5 - 3');
    assert.strictEqual(r.type, ExprType.BINARY);
    assert.strictEqual(r.operator, 45); // -
});

test('multiplication: 2 * 3', function () {
    var r = parseExpr('2 * 3');
    assert.strictEqual(r.type, ExprType.BINARY);
    assert.strictEqual(r.operator, 42); // *
});

test('division: 6 / 2', function () {
    var r = parseExpr('6 / 2');
    assert.strictEqual(r.type, ExprType.BINARY);
    assert.strictEqual(r.operator, 47); // /
});

test('modulo: 7 % 3', function () {
    var r = parseExpr('7 % 3');
    assert.strictEqual(r.type, ExprType.BINARY);
    assert.strictEqual(r.operator, 37); // %
});

// ============================================================
// 2. 优先级
// ============================================================

test('precedence: 1 + 2 * 3 → 1 + (2*3)', function () {
    var r = parseExpr('1 + 2 * 3');
    assert.strictEqual(r.type, ExprType.BINARY);
    assert.strictEqual(r.operator, 43); // +
    assert.strictEqual(r.segs[0].value, 1);
    assert.strictEqual(r.segs[1].type, ExprType.BINARY);
    assert.strictEqual(r.segs[1].operator, 42); // *
    assert.strictEqual(r.segs[1].segs[0].value, 2);
    assert.strictEqual(r.segs[1].segs[1].value, 3);
});

test('precedence: 2 * 3 + 1 → (2*3) + 1', function () {
    var r = parseExpr('2 * 3 + 1');
    assert.strictEqual(r.operator, 43); // +
    assert.strictEqual(r.segs[0].operator, 42); // *
    assert.strictEqual(r.segs[1].value, 1);
});

test('precedence: 1 + 2 * 3 > 4 → ((1+(2*3)) > 4)', function () {
    var r = parseExpr('1 + 2 * 3 > 4');
    assert.strictEqual(r.type, ExprType.BINARY);
    assert.strictEqual(r.operator, 62); // >
    var lhs = r.segs[0];
    assert.strictEqual(lhs.operator, 43); // +
    assert.strictEqual(lhs.segs[1].operator, 42); // *
});

test('precedence: a == b && c || d → ((a==b) && c) || d', function () {
    var r = parseExpr('a == b && c || d');
    assert.strictEqual(r.operator, 248); // ||
    var lhs = r.segs[0];
    assert.strictEqual(lhs.operator, 76); // &&
    assert.strictEqual(lhs.segs[0].operator, 122); // ==
});

test('precedence: a || b && c → a || (b && c)', function () {
    var r = parseExpr('a || b && c');
    assert.strictEqual(r.operator, 248); // ||
    assert.strictEqual(r.segs[0].type, ExprType.ACCESSOR);
    assert.strictEqual(r.segs[1].operator, 76); // &&
});

test('precedence: relational vs equality: a < b == c → (a < b) == c', function () {
    var r = parseExpr('a < b == c');
    assert.strictEqual(r.operator, 122); // ==
    assert.strictEqual(r.segs[0].operator, 60); // <
});

// ============================================================
// 3. 结合性
// ============================================================

test('left-assoc additive: a + b + c → (a+b) + c', function () {
    var r = parseExpr('a + b + c');
    assert.strictEqual(r.operator, 43);
    assert.strictEqual(r.segs[0].type, ExprType.BINARY);
    assert.strictEqual(r.segs[0].operator, 43);
    assert.strictEqual(r.segs[1].type, ExprType.ACCESSOR);
    // LHS should be (a+b), RHS should be c
    assert.strictEqual(r.segs[0].segs[0].paths[0].value, 'a');
    assert.strictEqual(r.segs[0].segs[1].paths[0].value, 'b');
    assert.strictEqual(r.segs[1].paths[0].value, 'c');
});

test('left-assoc multiplicative: a * b * c → (a*b) * c', function () {
    var r = parseExpr('a * b * c');
    assert.strictEqual(r.operator, 42);
    assert.strictEqual(r.segs[0].operator, 42);
    assert.strictEqual(r.segs[1].paths[0].value, 'c');
});

test('left-assoc mixed additive: a + b - c → (a+b) - c', function () {
    var r = parseExpr('a + b - c');
    assert.strictEqual(r.operator, 45); // -
    assert.strictEqual(r.segs[0].operator, 43); // +
});

test('right-assoc logical AND: a && b && c → a && (b && c)', function () {
    var r = parseExpr('a && b && c');
    assert.strictEqual(r.operator, 76); // &&
    assert.strictEqual(r.segs[0].paths[0].value, 'a');
    assert.strictEqual(r.segs[1].type, ExprType.BINARY);
    assert.strictEqual(r.segs[1].operator, 76);
    assert.strictEqual(r.segs[1].segs[0].paths[0].value, 'b');
    assert.strictEqual(r.segs[1].segs[1].paths[0].value, 'c');
});

test('right-assoc logical OR: a || b || c → a || (b || c)', function () {
    var r = parseExpr('a || b || c');
    assert.strictEqual(r.operator, 248);
    assert.strictEqual(r.segs[0].paths[0].value, 'a');
    assert.strictEqual(r.segs[1].operator, 248);
});

// ============================================================
// 4. 关系运算
// ============================================================

test('relational <: a < b', function () {
    var r = parseExpr('a < b');
    assert.strictEqual(r.operator, 60);
});

test('relational >: a > b', function () {
    var r = parseExpr('a > b');
    assert.strictEqual(r.operator, 62);
});

test('relational <=: a <= b', function () {
    var r = parseExpr('a <= b');
    assert.strictEqual(r.operator, 121);
});

test('relational >=: a >= b', function () {
    var r = parseExpr('a >= b');
    assert.strictEqual(r.operator, 123);
});

// ============================================================
// 5. 相等比对
// ============================================================

test('equality ==: a == b', function () {
    var r = parseExpr('a == b');
    assert.strictEqual(r.operator, 122);
});

test('equality ===: a === b', function () {
    var r = parseExpr('a === b');
    assert.strictEqual(r.operator, 183);
});

test('equality !=: a != b', function () {
    var r = parseExpr('a != b');
    assert.strictEqual(r.operator, 94);
});

test('equality !==: a !== b', function () {
    var r = parseExpr('a !== b');
    assert.strictEqual(r.operator, 155);
});

// ============================================================
// 6. 逻辑运算
// ============================================================

test('logical OR: a || b', function () {
    var r = parseExpr('a || b');
    assert.strictEqual(r.type, ExprType.BINARY);
    assert.strictEqual(r.operator, 248);
});

test('logical AND: a && b', function () {
    var r = parseExpr('a && b');
    assert.strictEqual(r.type, ExprType.BINARY);
    assert.strictEqual(r.operator, 76);
});

// ============================================================
// 7. 三元表达式
// ============================================================

test('ternary: a ? b : c', function () {
    var r = parseExpr('a ? b : c');
    assert.strictEqual(r.type, ExprType.TERTIARY);
    assert.strictEqual(r.segs.length, 3);
    assert.strictEqual(r.segs[0].paths[0].value, 'a');
    assert.strictEqual(r.segs[1].paths[0].value, 'b');
    assert.strictEqual(r.segs[2].paths[0].value, 'c');
});

test('nested ternary: a ? b ? c : d : e → right-assoc', function () {
    var r = parseExpr('a ? b ? c : d : e');
    assert.strictEqual(r.type, ExprType.TERTIARY);
    // yesExpr should be another tertiary
    assert.strictEqual(r.segs[1].type, ExprType.TERTIARY);
    assert.strictEqual(r.segs[1].segs[0].paths[0].value, 'b');
    assert.strictEqual(r.segs[1].segs[1].paths[0].value, 'c');
    assert.strictEqual(r.segs[1].segs[2].paths[0].value, 'd');
    assert.strictEqual(r.segs[2].paths[0].value, 'e');
});

test('ternary with binary condition: a > b ? c : d', function () {
    var r = parseExpr('a > b ? c : d');
    assert.strictEqual(r.type, ExprType.TERTIARY);
    assert.strictEqual(r.segs[0].operator, 62);
});

test('ternary in ternary no-branch: a ? b : c ? d : e', function () {
    var r = parseExpr('a ? b : c ? d : e');
    assert.strictEqual(r.type, ExprType.TERTIARY);
    assert.strictEqual(r.segs[1].paths[0].value, 'b');
    // noExpr is c ? d : e
    assert.strictEqual(r.segs[2].type, ExprType.TERTIARY);
});

// ============================================================
// 8. 一元运算
// ============================================================

test('unary !: !a', function () {
    var r = parseExpr('!a');
    assert.strictEqual(r.type, ExprType.UNARY);
    assert.strictEqual(r.operator, 33);
});

test('unary -: -a', function () {
    var r = parseExpr('-a');
    assert.strictEqual(r.type, ExprType.UNARY);
    assert.strictEqual(r.operator, 45);
});

test('unary +: +a', function () {
    var r = parseExpr('+a');
    assert.strictEqual(r.type, ExprType.UNARY);
    assert.strictEqual(r.operator, 43);
});

test('unary constant folding: -1', function () {
    var r = parseExpr('-1');
    assert.strictEqual(r.type, ExprType.NUMBER);
    assert.strictEqual(r.value, -1);
});

test('unary constant folding: !true', function () {
    var r = parseExpr('!true');
    assert.strictEqual(r.type, ExprType.BOOL);
    assert.strictEqual(r.value, false);
});

// ============================================================
// 9. Call 和 Accessor 混合
// ============================================================

test('call: foo(a, b)', function () {
    var r = parseExpr('foo(a, b)');
    assert.strictEqual(r.type, ExprType.CALL);
    assert.strictEqual(r.name.paths[0].value, 'foo');
    assert.strictEqual(r.args.length, 2);
});

test('accessor: a.b.c', function () {
    var r = parseExpr('a.b.c');
    assert.strictEqual(r.type, ExprType.ACCESSOR);
    assert.strictEqual(r.paths.length, 3);
    assert.strictEqual(r.paths[0].value, 'a');
    assert.strictEqual(r.paths[1].value, 'b');
    assert.strictEqual(r.paths[2].value, 'c');
});

test('accessor + call: a.b(x)', function () {
    var r = parseExpr('a.b(x)');
    assert.strictEqual(r.type, ExprType.CALL);
    assert.strictEqual(r.name.type, ExprType.ACCESSOR);
    assert.strictEqual(r.name.paths.length, 2);
    assert.strictEqual(r.args.length, 1);
});

test('call in binary: foo() + bar()', function () {
    var r = parseExpr('foo() + bar()');
    assert.strictEqual(r.type, ExprType.BINARY);
    assert.strictEqual(r.operator, 43);
    assert.strictEqual(r.segs[0].type, ExprType.CALL);
    assert.strictEqual(r.segs[1].type, ExprType.CALL);
});

test('call in ternary: a ? foo() : bar()', function () {
    var r = parseExpr('a ? foo() : bar()');
    assert.strictEqual(r.type, ExprType.TERTIARY);
    assert.strictEqual(r.segs[1].type, ExprType.CALL);
    assert.strictEqual(r.segs[2].type, ExprType.CALL);
});

test('nested call: foo(bar(x))', function () {
    var r = parseExpr('foo(bar(x))');
    assert.strictEqual(r.type, ExprType.CALL);
    assert.strictEqual(r.args[0].type, ExprType.CALL);
    assert.strictEqual(r.args[0].name.paths[0].value, 'bar');
});

test('accessor bracket: a[0]', function () {
    var r = parseExpr('a[0]');
    assert.strictEqual(r.type, ExprType.ACCESSOR);
    assert.strictEqual(r.paths[1].type, ExprType.NUMBER);
    assert.strictEqual(r.paths[1].value, 0);
});

test('accessor bracket expr: a[b + 1]', function () {
    var r = parseExpr('a[b + 1]');
    assert.strictEqual(r.type, ExprType.ACCESSOR);
    assert.strictEqual(r.paths[1].type, ExprType.BINARY);
    assert.strictEqual(r.paths[1].operator, 43);
});

// ============================================================
// 10. 括号表达式
// ============================================================

test('parenthesized: (1 + 2) * 3', function () {
    var r = parseExpr('(1 + 2) * 3');
    assert.strictEqual(r.type, ExprType.BINARY);
    assert.strictEqual(r.operator, 42); // *
    assert.strictEqual(r.segs[0].parenthesized, true);
    assert.strictEqual(r.segs[0].operator, 43); // +
    assert.strictEqual(r.segs[1].value, 3);
});

test('parenthesized in ternary: (a || b) ? c : d', function () {
    var r = parseExpr('(a || b) ? c : d');
    assert.strictEqual(r.type, ExprType.TERTIARY);
    assert.strictEqual(r.segs[0].parenthesized, true);
    assert.strictEqual(r.segs[0].operator, 248);
});

// ============================================================
// 11. 字面量
// ============================================================

test('number literal: 42', function () {
    var r = parseExpr('42');
    assert.strictEqual(r.type, ExprType.NUMBER);
    assert.strictEqual(r.value, 42);
});

test('float literal: 3.14', function () {
    var r = parseExpr('3.14');
    assert.strictEqual(r.type, ExprType.NUMBER);
    assert.strictEqual(r.value, 3.14);
});

test('string literal: "hello"', function () {
    var r = parseExpr('"hello"');
    assert.strictEqual(r.type, ExprType.STRING);
    assert.strictEqual(r.value, 'hello');
});

test('string literal single quote', function () {
    var r = parseExpr("'world'");
    assert.strictEqual(r.type, ExprType.STRING);
    assert.strictEqual(r.value, 'world');
});

test('bool true', function () {
    var r = parseExpr('true');
    assert.strictEqual(r.type, ExprType.BOOL);
    assert.strictEqual(r.value, true);
});

test('bool false', function () {
    var r = parseExpr('false');
    assert.strictEqual(r.type, ExprType.BOOL);
    assert.strictEqual(r.value, false);
});

test('null', function () {
    var r = parseExpr('null');
    assert.strictEqual(r.type, ExprType.NULL);
});

test('array literal: [1, 2, 3]', function () {
    var r = parseExpr('[1, 2, 3]');
    assert.strictEqual(r.type, ExprType.ARRAY);
    assert.strictEqual(r.items.length, 3);
});

test('object literal: {a: 1, b: 2}', function () {
    var r = parseExpr('{a: 1, b: 2}');
    assert.strictEqual(r.type, ExprType.OBJECT);
    assert.strictEqual(r.items.length, 2);
    assert.strictEqual(r.items[0].name.value, 'a');
    assert.strictEqual(r.items[1].name.value, 'b');
});

// ============================================================
// 12. 模板插值 (parseText)
// ============================================================

test('parseText plain text', function () {
    var r = parseText('hello world');
    assert.strictEqual(r.type, ExprType.STRING);
    assert.strictEqual(r.value, 'hello world');
});

test('parseText with interpolation', function () {
    var r = parseText('hello {{name}}!');
    assert.strictEqual(r.type, ExprType.TEXT);
    assert.strictEqual(r.segs.length, 3);
    assert.strictEqual(r.segs[0].value, 'hello ');
    assert.strictEqual(r.segs[1].type, ExprType.INTERP);
    assert.strictEqual(r.segs[1].expr.paths[0].value, 'name');
    assert.strictEqual(r.segs[2].value, '!');
});

test('parseText with filter', function () {
    var r = parseText('{{name | uppercase}}');
    assert.strictEqual(r.type, ExprType.INTERP);
    assert.strictEqual(r.filters.length, 1);
    assert.strictEqual(r.filters[0].name.paths[0].value, 'uppercase');
});

test('parseText with expression in interpolation', function () {
    var r = parseText('{{a + b}}');
    assert.strictEqual(r.type, ExprType.BINARY);
    assert.strictEqual(r.operator, 43);
});

test('parseText with ternary in interpolation', function () {
    var r = parseText('{{a ? b : c}}');
    assert.strictEqual(r.type, ExprType.TERTIARY);
});

test('parseText pure interp returns expr directly', function () {
    var r = parseText('{{a}}');
    assert.strictEqual(r.type, ExprType.ACCESSOR);
});

test('parseText empty returns empty string', function () {
    var r = parseText('');
    assert.strictEqual(r.type, ExprType.STRING);
    assert.strictEqual(r.value, '');
});

// ============================================================
// 13. 复杂混合场景
// ============================================================

test('complex: a.b(c, d.e) + f > g && h || i ? j : k', function () {
    var r = parseExpr('a.b(c, d.e) + f > g && h || i ? j : k');
    assert.strictEqual(r.type, ExprType.TERTIARY);
    // condition: ((a.b(c, d.e) + f > g) && h) || i
    var cond = r.segs[0];
    assert.strictEqual(cond.operator, 248); // ||
});

test('complex: chained comparison in ternary: a < b ? c + d : e * f', function () {
    var r = parseExpr('a < b ? c + d : e * f');
    assert.strictEqual(r.type, ExprType.TERTIARY);
    assert.strictEqual(r.segs[0].operator, 60); // <
    assert.strictEqual(r.segs[1].operator, 43); // +
    assert.strictEqual(r.segs[2].operator, 42); // *
});

test('complex: multiple unary + binary: !a && -b + c', function () {
    var r = parseExpr('!a && -b + c');
    assert.strictEqual(r.operator, 76); // &&
    assert.strictEqual(r.segs[0].type, ExprType.UNARY);
    assert.strictEqual(r.segs[0].operator, 33); // !
    // RHS is (-b) + c
    assert.strictEqual(r.segs[1].operator, 43); // +
});

test('complex: accessor in binary chain: a.x + b.y * c.z', function () {
    var r = parseExpr('a.x + b.y * c.z');
    assert.strictEqual(r.operator, 43); // +
    assert.strictEqual(r.segs[0].type, ExprType.ACCESSOR);
    assert.strictEqual(r.segs[1].operator, 42); // *
});

test('complex: call + accessor + binary: fn(a) + obj.b > 0', function () {
    var r = parseExpr('fn(a) + obj.b > 0');
    assert.strictEqual(r.operator, 62); // >
    var lhs = r.segs[0];
    assert.strictEqual(lhs.operator, 43); // +
    assert.strictEqual(lhs.segs[0].type, ExprType.CALL);
    assert.strictEqual(lhs.segs[1].type, ExprType.ACCESSOR);
});

test('whitespace handling: "  1  +  2  "', function () {
    var r = parseExpr('  1  +  2  ');
    assert.strictEqual(r.type, ExprType.BINARY);
    assert.strictEqual(r.operator, 43);
    assert.strictEqual(r.segs[0].value, 1);
    assert.strictEqual(r.segs[1].value, 2);
});

test('string escape: "hello\\nworld"', function () {
    var r = parseExpr('"hello\\nworld"');
    assert.strictEqual(r.type, ExprType.STRING);
    assert.strictEqual(r.value, 'hello\nworld');
});

// ============================================================
// 14. parseExpr 入口行为
// ============================================================

test('parseExpr with empty input', function () {
    var r = parseExpr('');
    assert.strictEqual(r, undefined);
});

test('parseExpr with falsy input', function () {
    var r = parseExpr(null);
    assert.strictEqual(r, undefined);
});

test('parseExpr with pre-parsed object', function () {
    var obj = {type: ExprType.NUMBER, value: 42};
    var r = parseExpr(obj);
    assert.strictEqual(r, obj);
});

// ============================================================
// 15. 向后兼容：旧模块路径仍可用
// ============================================================

test('backward compat: read-logical-or-expr re-exports', function () {
    var m = require('../src/parser/read-logical-or-expr');
    assert.strictEqual(typeof m, 'function');
});

test('backward compat: read-logical-and-expr re-exports', function () {
    var m = require('../src/parser/read-logical-and-expr');
    assert.strictEqual(typeof m, 'function');
});

test('backward compat: read-equality-expr re-exports', function () {
    var m = require('../src/parser/read-equality-expr');
    assert.strictEqual(typeof m, 'function');
});

test('backward compat: read-relational-expr re-exports', function () {
    var m = require('../src/parser/read-relational-expr');
    assert.strictEqual(typeof m, 'function');
});

test('backward compat: read-additive-expr re-exports', function () {
    var m = require('../src/parser/read-additive-expr');
    assert.strictEqual(typeof m, 'function');
});

test('backward compat: read-multiplicative-expr re-exports', function () {
    var m = require('../src/parser/read-multiplicative-expr');
    assert.strictEqual(typeof m, 'function');
});

// ============================================================
// 16. 边界情况
// ============================================================

test('single number: 0', function () {
    var r = parseExpr('0');
    assert.strictEqual(r.type, ExprType.NUMBER);
    assert.strictEqual(r.value, 0);
});

test('nested parens: ((a))', function () {
    var r = parseExpr('((a))');
    assert.strictEqual(r.parenthesized, true);
});

test('empty array: []', function () {
    var r = parseExpr('[]');
    assert.strictEqual(r.type, ExprType.ARRAY);
    assert.strictEqual(r.items.length, 0);
});

test('empty object: {}', function () {
    var r = parseExpr('{}');
    assert.strictEqual(r.type, ExprType.OBJECT);
    assert.strictEqual(r.items.length, 0);
});

test('deeply nested ternary: a ? b ? c ? d : e : f : g', function () {
    var r = parseExpr('a ? b ? c ? d : e : f : g');
    assert.strictEqual(r.type, ExprType.TERTIARY);
    assert.strictEqual(r.segs[1].type, ExprType.TERTIARY);
    assert.strictEqual(r.segs[1].segs[1].type, ExprType.TERTIARY);
});

test('call with no args: foo()', function () {
    var r = parseExpr('foo()');
    assert.strictEqual(r.type, ExprType.CALL);
    assert.strictEqual(r.args.length, 0);
});

test('chained accessors: a[0].b[1]', function () {
    var r = parseExpr('a[0].b[1]');
    assert.strictEqual(r.type, ExprType.ACCESSOR);
    assert.strictEqual(r.paths.length, 4);
});

// ============================================================
// 结果汇总
// ============================================================

console.log('\n' + passed + ' passed, ' + failed + ' failed');
if (failed > 0) {
    process.exit(1);
}
