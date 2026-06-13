/**
 * Copyright (c) Baidu Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license.
 * See LICENSE file in the project root for license information.
 *
 * @file 统一的节点工厂方法
 *
 * 普通创建和 hydrate 反解共用同一套装配流程。
 * 通过可选的 hydrateWalker 参数区分两条链路：
 *   - hydrateWalker 存在时走反解链路，节点从已有 DOM 中恢复状态
 *   - hydrateWalker 为空时走普通创建链路，节点完全由模板构建
 *
 * 装配决策顺序：
 *   1. aNode.elem  → 已被标记为纯元素（preheat 阶段），直接创建 Element
 *   2. aNode.Clazz → 已被 preheat 绑定到特定节点类（if/for/fragment/slot/text 等）
 *   3. owner.components 查询 → 找到注册组件或 loader
 *      - function → 同步组件实例化
 *      - object   → 异步组件（ComponentLoader）
 *   4. s-is 指令特判 → fragment / template 走 FragmentNode
 *   5. 兜底 → 标记 aNode.elem 并创建 Element
 */

var Element = require('./element');
var FragmentNode = require('./fragment-node');
var AsyncComponent = require('./async-component');


/**
 * 统一的节点创建工厂
 *
 * @param {ANode} aNode 抽象节点
 * @param {Node} parent 父亲节点
 * @param {Model} scope 所属数据环境
 * @param {Component} owner 所属组件环境
 * @param {string|DOMChildrenWalker} componentNameOrWalker
 *     普通创建时为组件名（string），
 *     hydrate 时为 DOMChildrenWalker
 * @param {string} componentName
 *     仅 hydrate 链路使用，组件名覆盖
 * @return {Node}
 */
function createNode(aNode, parent, scope, owner, componentNameOrWalker, componentName) {
    // 判断当前是否走 hydrate 链路
    // hydrateWalker 是 DOMChildrenWalker 实例，具备 goNext 方法
    var hydrateWalker;
    if (componentNameOrWalker && typeof componentNameOrWalker === 'object') {
        hydrateWalker = componentNameOrWalker;
    }
    else {
        componentName = componentNameOrWalker;
    }

    // ---- step 1: preheat 阶段已标记为纯元素 ----
    if (aNode.elem) {
        return hydrateWalker
            ? new Element(aNode, parent, scope, owner, componentName, hydrateWalker)
            : new Element(aNode, parent, scope, owner, componentName);
    }

    // ---- step 2: preheat 阶段已绑定节点类（if / for / fragment / slot / text 等） ----
    if (aNode.Clazz) {
        return hydrateWalker
            ? new aNode.Clazz(aNode, parent, scope, owner, hydrateWalker)
            : new aNode.Clazz(aNode, parent, scope, owner);
    }

    // ---- step 3: 组件解析 ----
    var resolvedName = componentName || aNode.tagName;
    var ComponentOrLoader = owner.components && owner.components[resolvedName];

    if (ComponentOrLoader) {
        // 同步组件 vs 异步 loader
        if (typeof ComponentOrLoader === 'function') {
            var componentOptions = {
                source: aNode,
                owner: owner,
                scope: scope,
                parent: parent
            };
            // #[begin] hydrate
            if (hydrateWalker) {
                componentOptions.hydrateWalker = hydrateWalker;
            }
            // #[end]
            return new ComponentOrLoader(componentOptions);
        }

        // 异步组件 loader
        var asyncOptions = {
            source: aNode,
            owner: owner,
            scope: scope,
            parent: parent
        };
        // #[begin] hydrate
        if (hydrateWalker) {
            asyncOptions.hydrateWalker = hydrateWalker;
        }
        // #[end]
        return new AsyncComponent(asyncOptions, ComponentOrLoader);
    }

    // ---- step 4: s-is 指令 fragment / template 特判 ----
    if (aNode.directives.is) {
        switch (componentName) {
            case 'fragment':
            case 'template':
                return hydrateWalker
                    ? new FragmentNode(aNode, parent, scope, owner, hydrateWalker)
                    : new FragmentNode(aNode, parent, scope, owner);
        }
    }
    else {
        // 非 is 指令、非组件 → 标记为纯元素，后续不再走组件解析
        aNode.elem = true;
    }

    // ---- step 5: 兜底 Element ----
    return hydrateWalker
        ? new Element(aNode, parent, scope, owner, componentName, hydrateWalker)
        : new Element(aNode, parent, scope, owner, componentName);
}

exports = module.exports = createNode;
