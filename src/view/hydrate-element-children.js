/**
 * Copyright (c) Baidu Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license.
 * See LICENSE file in the project root for license information.
 *
 * @file 对元素的子节点进行反解
 */


var DOMChildrenWalker = require('./dom-children-walker');
var createHydrateNode = require('./create-hydrate-node');

// #[begin] hydrate

/**
 * 对元素的子节点进行反解
 *
 * 职责划分：
 *   - 本函数负责创建 DOMChildrenWalker 并驱动子节点创建循环
 *   - walker 的推进由各个子节点构造函数内部负责
 *   - 子节点工厂统一走 createHydrateNode -> createNode
 *
 * @param {Object} element 元素（具备 el / aNode / children）
 * @param {Model} scope 所属数据环境
 * @param {Component} owner 所属组件环境
 */
function hydrateElementChildren(element, scope, owner) {
    var htmlDirective = element.aNode.directives.html;

    if (!htmlDirective) {
        var walker = new DOMChildrenWalker(element.el);
        var aNodeChildren = element.aNode.children;
        
        for (var i = 0, l = aNodeChildren.length; i < l; i++) {
            element.children.push(
                createHydrateNode(aNodeChildren[i], element, scope, owner, walker)
            );
        }
    }
}
// #[end]

exports = module.exports = hydrateElementChildren;
