/**
 * Copyright (c) Baidu Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license.
 * See LICENSE file in the project root for license information.
 *
 * @file Data 模块内部共享工具
 */

var ExprType = require('../parser/expr-type');
var parseExpr = require('../parser/parse-expr');

/**
 * 解析并校验一个表达式必须是 accessor 类型
 *
 * @inner
 * @param {string|Object} expr 表达式
 * @param {string} methodName 调用方法名，用于错误提示
 * @return {Object} 解析后的表达式对象
 */
function parseAccessor(expr, methodName) {
    // #[begin] error
    var exprRaw = expr;
    // #[end]

    expr = parseExpr(expr);

    // #[begin] error
    if (expr.type !== ExprType.ACCESSOR) {
        throw new Error('[SAN ERROR] Invalid Expression in Data ' + methodName + ': ' + exprRaw);
    }
    // #[end]

    return expr;
}

/**
 * 判断 option 是否为静默模式
 *
 * @inner
 * @param {Object} option 选项对象
 * @return {boolean}
 */
function isSilent(option) {
    return !!(option && (option.silent || option.silence || option.quiet));
}

/**
 * 构造一个 ACCESSOR 表达式对象（复制 paths 避免外部引用被修改）
 *
 * @inner
 * @param {Object} expr 原始 accessor 表达式
 * @return {Object} 新的 ACCESSOR 表达式
 */
function cloneAccessor(expr) {
    return {
        type: ExprType.ACCESSOR,
        paths: expr.paths.slice(0)
    };
}

/**
 * 构造单级 ACCESSOR 表达式
 *
 * @inner
 * @param {string} key 属性名
 * @return {Object} ACCESSOR 表达式
 */
function accessorOf(key) {
    return {
        type: ExprType.ACCESSOR,
        paths: [{type: ExprType.STRING, value: key}]
    };
}

/**
 * 在已有 accessor 的 paths 上追加一级属性，返回新表达式
 *
 * @inner
 * @param {Object} expr 原始 accessor 表达式
 * @param {string} key 追加的属性名
 * @return {Object} 新的 ACCESSOR 表达式
 */
function appendPath(expr, key) {
    return {
        type: ExprType.ACCESSOR,
        paths: expr.paths.concat([{type: ExprType.STRING, value: key}])
    };
}

/**
 * 规范化 splice 的起始索引：
 * - 负数从末尾算起
 * - 越界截断
 *
 * @inner
 * @param {number} index 原始索引
 * @param {number} len 数组长度
 * @return {number} 规范化后的索引
 */
function normalizeSpliceIndex(index, len) {
    if (index > len) {
        return len;
    }
    if (index < 0) {
        index = len + index;
        if (index < 0) {
            index = 0;
        }
    }
    return index;
}

exports = module.exports = {parseAccessor: parseAccessor, isSilent: isSilent, cloneAccessor: cloneAccessor, accessorOf: accessorOf, appendPath: appendPath, normalizeSpliceIndex: normalizeSpliceIndex};
