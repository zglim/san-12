/**
 * Copyright (c) Baidu Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license.
 * See LICENSE file in the project root for license information.
 *
 * @file 统一的二元表达式读取器
 *
 * 将原先分散在 6 个文件中的优先级读取逻辑合并为一张配置表 + 一个核心函数。
 * 优先级从低到高（表中从前往后）：
 *   ||  →  &&  →  equality  →  relational  →  additive  →  multiplicative
 *
 * 每一层定义三个要素：
 *   1. matchOp(walker) — 尝试匹配操作符，成功返回 operator code，失败返回 0（并还原 walker 位置）
 *   2. mode — 'left'（左结合，while 循环）| 'right'（右结合，递归）| 'once'（单次匹配）
 *   3. 隐式：下层读取器即表中前一层的 reader
 */

var ExprType = require('./expr-type');
var readUnaryExpr = require('./read-unary-expr');


// ---- 操作符匹配函数 ----

/**
 * 单字符匹配：当前 charCode 在集合中则消耗并返回 charCode
 */
function matchSingleCharOps(charCodes) {
    return function (walker) {
        var code = walker.source.charCodeAt(walker.index);
        for (var i = 0; i < charCodes.length; i++) {
            if (code === charCodes[i]) {
                walker.index++;
                return code;
            }
        }
        return 0;
    };
}

/**
 * 关系运算匹配：< > <= >=
 */
function matchRelationalOp(walker) {
    var code = walker.source.charCodeAt(walker.index);
    if (code === 60 || code === 62) { // < >
        if (walker.nextCode() === 61) { // =
            code += 61; // <= → 121, >= → 123
            walker.index++;
        }
        return code;
    }
    return 0;
}

/**
 * 相等比对匹配：== === != !==
 */
function matchEqualityOp(walker) {
    var code = walker.source.charCodeAt(walker.index);
    if (code === 61 || code === 33) { // = !
        if (walker.nextCode() === 61) { // =
            code += 61; // == → 122, != → 94
            if (walker.nextCode() === 61) { // =
                code += 61; // === → 183, !== → 155
                walker.index++;
            }
            return code;
        }
        walker.index--;
    }
    return 0;
}

/**
 * 双字符操作符匹配：如 && ||
 */
function matchDoubleCharOp(charCode, opCode) {
    return function (walker) {
        if (walker.source.charCodeAt(walker.index) === charCode) {
            if (walker.nextCode() === charCode) {
                walker.index++;
                return opCode;
            }
            walker.index--;
        }
        return 0;
    };
}


// ---- 优先级表（从低到高） ----

var LEVELS = [
    // Logical OR: || (右结合)
    { matchOp: matchDoubleCharOp(124, 248), mode: 'right' },

    // Logical AND: && (右结合)
    { matchOp: matchDoubleCharOp(38, 76), mode: 'right' },

    // Equality: == === != !== (单次匹配)
    { matchOp: matchEqualityOp, mode: 'once' },

    // Relational: < > <= >= (单次匹配)
    { matchOp: matchRelationalOp, mode: 'once' },

    // Additive: + - (左结合)
    { matchOp: matchSingleCharOps([43, 45]), mode: 'left' },

    // Multiplicative: * / % (左结合)
    { matchOp: matchSingleCharOps([37, 42, 47]), mode: 'left' }
];


// ---- 核心构建 ----

/**
 * 为指定优先级层创建 reader
 *
 * @param {number} levelIndex 当前层在 LEVELS 中的索引
 * @param {Function} lowerReader 下一层（更高优先级）的读取器
 * @return {Function}
 */
function createLevelReader(levelIndex, lowerReader) {
    var level = LEVELS[levelIndex];
    var matchOp = level.matchOp;
    var mode = level.mode;

    function reader(walker) {
        var expr = lowerReader(walker);

        if (mode === 'left') {
            // 左结合：while 循环
            while (1) {
                walker.goUntil();
                var op = matchOp(walker);
                if (!op) break;
                expr = {
                    type: ExprType.BINARY,
                    operator: op,
                    segs: [expr, lowerReader(walker)]
                };
            }
            return expr;
        }

        // 'right' 或 'once'：单次匹配
        walker.goUntil();
        var op = matchOp(walker);
        if (op) {
            return {
                type: ExprType.BINARY,
                operator: op,
                segs: [
                    expr,
                    mode === 'right' ? reader(walker) : lowerReader(walker)
                ]
            };
        }

        return expr;
    }

    return reader;
}


// 从最高优先级（multiplicative）向最低优先级（logical OR）逐层构建
// LEVELS 的最后一项是 multiplicative（最高优先级），它基于 readUnaryExpr
var binaryReader = readUnaryExpr;
for (var i = LEVELS.length - 1; i >= 0; i--) {
    binaryReader = createLevelReader(i, binaryReader);
}


/**
 * 读取二元表达式（从逻辑或到乘法的全部优先级）
 *
 * @param {Walker} walker 源码读取对象
 * @return {Object}
 */
exports = module.exports = binaryReader;
