/**
 * Copyright (c) Baidu Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license.
 * See LICENSE file in the project root for license information.
 *
 * @file 从 parent 向上查找最近的组件节点
 */

var NodeType = require('./node-type');

/**
 * 解析 parentComponent
 *
 * @param {Node} parent 父亲节点
 * @return {Component}
 */
function resolveParentComponent(parent) {
    return parent.nodeType === NodeType.CMPT
        ? parent
        : parent.parentComponent;
}

exports = module.exports = resolveParentComponent;
