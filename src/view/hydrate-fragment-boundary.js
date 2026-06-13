/**
 * Copyright (c) Baidu Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license.
 * See LICENSE file in the project root for license information.
 *
 * @file fragment 型节点的 hydrate 边界处理
 *
 * 统一 fragment-node / slot-node 等在 hydrate 时的三步流程：
 *   1. 读取或补全 start comment 边界
 *   2. 由调用方通过回调创建子节点（walker 推进由子节点自行负责）
 *   3. 读取或补全 end comment 边界
 *
 * 职责划分：
 *   - 本函数负责推进 walker 越过 start/end comment
 *   - 本函数负责在 SSR 未输出标记时补 comment
 *   - 子节点的创建和 walker 推进由 createChildren 回调负责
 */

var insertBefore = require('../browser/insert-before');

// #[begin] hydrate
/**
 * fragment 型节点 hydrate 边界处理
 *
 * @param {Object} node         当前节点实例（写入 sel / el / id）
 * @param {DOMChildrenWalker} hydrateWalker  子元素遍历对象
 * @param {string=} startFlag   SSR 起始标记名（如 's-slot'），
 *                              为空时只判断 comment 类型
 * @param {Function} createChildren  回调：创建子节点
 */
function hydrateFragmentBoundary(node, hydrateWalker, startFlag, createChildren) {
    var currentNode = hydrateWalker.current;
    var hasFlagComment;

    // ---- start flag ----
    if (currentNode && currentNode.nodeType === 8
        && (!startFlag || currentNode.data === startFlag)
    ) {
        node.sel = currentNode;
        hasFlagComment = 1;
        hydrateWalker.goNext();
    }
    else {
        node.sel = hydrateWalker.doc.createComment(node.id);
        insertBefore(node.sel, hydrateWalker.target, hydrateWalker.current);
    }

    // ---- content (由调用方负责) ----
    createChildren();

    // ---- end flag ----
    if (hasFlagComment) {
        node.el = hydrateWalker.current;
        hydrateWalker.goNext();
    }
    else {
        node.el = hydrateWalker.doc.createComment(node.id);
        insertBefore(node.el, hydrateWalker.target, hydrateWalker.current);
    }
}
// #[end]

exports = module.exports = hydrateFragmentBoundary;
