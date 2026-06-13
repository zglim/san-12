/**
 * Copyright (c) Baidu Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license.
 * See LICENSE file in the project root for license information.
 *
 * @file 读取三元表达式
 *
 * 注意：module.exports 必须放在 require 之前，以解决与 read-call / read-unary-expr
 * 等模块之间的循环引用问题。函数声明会被提升，所以可以在定义之前导出。
 */

module.exports = readTertiaryExpr;

var ExprType = require('./expr-type');
var readBinaryExpr = require('./read-binary-expr');

/**
 * 读取三元表达式
 *
 * @param {Walker} walker 源码读取对象
 * @return {Object}
 */
function readTertiaryExpr(walker) {
    var conditional = readBinaryExpr(walker);
    walker.goUntil();

    if (walker.source.charCodeAt(walker.index) === 63) { // ?
        walker.index++;
        var yesExpr = readTertiaryExpr(walker);
        walker.goUntil();

        if (walker.source.charCodeAt(walker.index) === 58) { // :
            walker.index++;
            return {
                type: ExprType.TERTIARY,
                segs: [
                    conditional,
                    yesExpr,
                    readTertiaryExpr(walker)
                ]
            };
        }
    }

    return conditional;
}
