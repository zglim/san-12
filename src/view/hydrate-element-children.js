/**
 * Copyright (c) Baidu Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license.
 * See LICENSE file in the project root for license information.
 *
 * @file 对元素的子节点进行反解
 *
 * 职责划分：
 *   - 本函数负责创建 DOMChildrenWalker 并驱动子节点创建循环
 *   - walker 的推进由各个子节点构造函数内部负责（Element 吃掉当前元素并 goNext，
 *     TextNode / FragmentNode / SlotNode 等按需推进）
 *   - 子节点工厂统一走 createHydrateNode → createNode
 */


var DOMChildrenWalker = require('./dom-children-walker');
var createHydrateNode = require('./create-hydrate-node');

// #[begin] hydrate

/**
 * 对元素的子节点进行反解
 *
 * @param {Object} element 元素（具备 el / aNode / children）
 * @param {Model} scope 所属数据环境
 * @param {Component} owner 所属组件环境
 */
function hydrateElementChildren(element, scope, owner) {
    var htmlDirective = element.aNode.directives.html;

    if (!htmlDirective) {
        // walker 的生命周期由本函数管理：创建 → 传给子节点 → 子节点自行推进
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
