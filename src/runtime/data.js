/**
 * Copyright (c) Baidu Inc. All rights reserved.
 *
 * This source code is licensed under the MIT license.
 * See LICENSE file in the project root for license information.
 *
 * @file 数据类
 */

var ExprType = require('../parser/expr-type');
var evalExpr = require('./eval-expr');
var DataChangeType = require('./data-change-type');
var parseExpr = require('../parser/parse-expr');
var dataHelpers = require('./data-helpers');

// In the bundled build, the require above is commented out by the build tool
// and the helper functions become top-level declarations from data-helpers.js.
// This fallback only executes in the bundle where dataHelpers is undefined.
if (!dataHelpers) {
    /* global parseAccessor, isSilent, cloneAccessor, accessorOf, appendPath, normalizeSpliceIndex */
    var dataHelpers = {
        parseAccessor: parseAccessor,
        isSilent: isSilent,
        cloneAccessor: cloneAccessor,
        accessorOf: accessorOf,
        appendPath: appendPath,
        normalizeSpliceIndex: normalizeSpliceIndex
    };
}

var parseAccessor = dataHelpers.parseAccessor;
var isSilent = dataHelpers.isSilent;
var cloneAccessor = dataHelpers.cloneAccessor;
var accessorOf = dataHelpers.accessorOf;
var appendPath = dataHelpers.appendPath;
var normalizeSpliceIndex = dataHelpers.normalizeSpliceIndex;

/**
 * 数据类
 *
 * @class
 * @param {Object?} data 初始数据
 * @param {Model?} parent 父级数据容器
 */
function Data(data, parent) {
    this.parent = parent;
    this.raw = data || {};
    this.listeners = [];
}

// #[begin] error
// 以下两个函数只在开发模式下可用，在生产模式下不存在
/**
 * DataTypes 检测
 */
Data.prototype.checkDataTypes = function () {
    if (this.typeChecker) {
        this.typeChecker(this.raw);
    }
};

/**
 * 设置 type checker
 *
 * @param  {Function} typeChecker 类型校验器
 */
Data.prototype.setTypeChecker = function (typeChecker) {
    this.typeChecker = typeChecker;
};

// #[end]

/**
 * 添加数据变更的事件监听器
 *
 * @param {Function} listener 监听函数
 */
Data.prototype.listen = function (listener) {
    if (typeof listener === 'function') {
        this.listeners.push(listener);
    }
};

/**
 * 移除数据变更的事件监听器
 *
 * @param {Function} listener 监听函数
 */
Data.prototype.unlisten = function (listener) {
    var len = this.listeners.length;
    while (len--) {
        if (!listener || this.listeners[len] === listener) {
            this.listeners.splice(len, 1);
        }
    }
};

/**
 * 触发数据变更
 *
 * @param {Object} change 变更信息对象
 */
Data.prototype.fire = function (change) {
    for (var i = 0; i < this.listeners.length; i++) {
        this.listeners[i].call(this, change);
    }
};

/**
 * 获取数据项
 *
 * @param {string|Object?} expr 数据项路径
 * @param {Data?} callee 当前数据获取的调用环境
 * @return {*}
 */
Data.prototype.get = function (expr, callee) {
    var value = this.raw;
    if (!expr) {
        return value;
    }

    if (typeof expr !== 'object') {
        expr = parseExpr(expr);
    }

    var paths = expr.paths;
    callee = callee || this;

    value = value[paths[0].value];

    if (typeof value == 'undefined' && this.parent) {
        value = this.parent.get(expr, callee);
    }
    else {
        for (var i = 1, l = paths.length; value != null && i < l; i++) {
            value = value[paths[i].value || evalExpr(paths[i], callee)];
        }
    }

    return value;
};


/**
 * 数据对象变更操作
 *
 * @inner
 * @param {Object|Array} source 要变更的源数据
 * @param {Array} exprPaths 属性路径
 * @param {number} pathsStart 当前处理的属性路径指针位置
 * @param {number} pathsLen 属性路径长度
 * @param {*} value 变更属性值
 * @param {Data} data 对应的Data对象
 * @return {*} 变更后的新数据
 */
function immutableSet(source, exprPaths, pathsStart, pathsLen, value, data) {
    if (pathsStart >= pathsLen) {
        return value;
    }

    if (source == null) {
        source = {};
    }

    var pathExpr = exprPaths[pathsStart];
    var prop = evalExpr(pathExpr, data);
    var result = source;

    if (source instanceof Array) {
        var index = +prop;
        prop = isNaN(index) ? prop : index;

        result = source.slice(0);
        result[prop] = immutableSet(source[prop], exprPaths, pathsStart + 1, pathsLen, value, data);
    }
    else if (typeof source === 'object') {
        result = {};
        var needAssigned = true;

        for (var key in source) {
            /* istanbul ignore else  */
            if (source.hasOwnProperty(key)) {
                if (key === prop) {
                    needAssigned = false;
                    result[prop] = immutableSet(source[prop], exprPaths, pathsStart + 1, pathsLen, value, data);
                }
                else {
                    result[key] = source[key];
                }
            }
        }

        // 如果set的是一个不存在的属性，会走到该逻辑
        if (needAssigned) {
            result[prop] = immutableSet(source[prop], exprPaths, pathsStart + 1, pathsLen, value, data);
        }
    }

    if (pathExpr.value == null) {
        exprPaths[pathsStart] = {
            type: typeof prop === 'string' ? ExprType.STRING : ExprType.NUMBER,
            value: prop
        };
    }

    return result;
}

/**
 * 内部方法：执行 set 的变更提交（immutableSet + fire + checkDataTypes）
 *
 * @inner
 * @param {Data} data Data 实例
 * @param {Object} expr 已校验的 accessor 表达式
 * @param {*} value 新值
 * @param {Object} option 选项
 */
function commitSet(data, expr, value, option) {
    option = option || {};
    expr = cloneAccessor(expr);

    var prop = expr.paths[0].value;
    data.raw[prop] = immutableSet(data.raw[prop], expr.paths, 1, expr.paths.length, value, data);

    if (!isSilent(option)) {
        data.fire({
            type: DataChangeType.SET,
            expr: expr,
            value: value,
            option: option
        });
    }

    // #[begin] error
    data.checkDataTypes();
    // #[end]
}

/**
 * 内部方法：执行 splice 的变更提交
 *
 * @inner
 * @param {Data} data Data 实例
 * @param {Object} expr 已校验的 accessor 表达式
 * @param {Array} args splice 参数
 * @param {Object} option 选项
 * @return {Array} 被删除的元素
 */
function commitSplice(data, expr, args, option) {
    option = option || {};
    expr = cloneAccessor(expr);

    var target = data.get(expr);
    var returnValue = [];

    if (target instanceof Array) {
        var index = normalizeSpliceIndex(args[0], target.length);

        var newArray = target.slice(0);
        returnValue = newArray.splice.apply(newArray, args);

        var prop = expr.paths[0].value;
        data.raw[prop] = immutableSet(data.raw[prop], expr.paths, 1, expr.paths.length, newArray, data);

        if (!isSilent(option)) {
            data.fire({
                expr: expr,
                type: DataChangeType.SPLICE,
                index: index,
                deleteCount: returnValue.length,
                value: returnValue,
                insertions: args.slice(2),
                option: option
            });
        }
    }

    // #[begin] error
    data.checkDataTypes();
    // #[end]

    return returnValue;
}

/**
 * 设置数据项
 *
 * @param {string|Object} expr 数据项路径
 * @param {*} value 数据值
 * @param {Object=} option 设置参数
 * @param {boolean} option.silent 静默设置，不触发变更事件
 */
Data.prototype.set = function (expr, value, option) {
    option = option || {};
    expr = parseAccessor(expr, 'set');

    if (this.get(expr) === value && !option.force) {
        return;
    }

    commitSet(this, expr, value, option);
};

/**
 * 批量设置数据
 *
 * @param {Object} source 待设置的数据集
 * @param {Object=} option 设置参数
 * @param {boolean} option.silent 静默设置，不触发变更事件
 */
Data.prototype.assign = function (source, option) {
    option = option || {};

    for (var key in source) { // eslint-disable-line
        this.set(accessorOf(key), source[key], option);
    }
};

/**
 * 合并更新数据项
 *
 * @param {string|Object} expr 数据项路径
 * @param {Object} source 待合并的数据
 * @param {Object=} option 设置参数
 * @param {boolean} option.silent 静默设置，不触发变更事件
 */
Data.prototype.merge = function (expr, source, option) {
    option = option || {};
    expr = parseAccessor(expr, 'merge');

    // #[begin] error
    var target = this.get(expr);
    if (typeof target !== 'object') {
        throw new Error(
            '[SAN ERROR] Merge Expects a Target of Type \'object\'; got ' + typeof target
        );
    }

    if (typeof source !== 'object') {
        throw new Error('[SAN ERROR] Merge Expects a Source of Type \'object\'; got ' + typeof source);
    }
    // #[end]

    for (var key in source) { // eslint-disable-line
        this.set(appendPath(expr, key), source[key], option);
    }
};

/**
 * 基于更新函数更新数据项
 *
 * @param {string|Object} expr 数据项路径
 * @param {Function} fn 数据处理函数
 * @param {Object=} option 设置参数
 * @param {boolean} option.silent 静默设置，不触发变更事件
 */
Data.prototype.apply = function (expr, fn, option) {
    expr = parseAccessor(expr, 'apply');

    // #[begin] error
    if (typeof fn !== 'function') {
        throw new Error(
            '[SAN ERROR] Invalid Argument\'s Type in Data apply: '
            + 'Expected Function but got ' + typeof fn
        );
    }
    // #[end]

    var oldValue = this.get(expr);
    this.set(expr, fn(oldValue), option);
};

/**
 * 数组数据项splice操作
 *
 * @param {string|Object} expr 数据项路径
 * @param {Array} args splice 接受的参数列表，数组项与Array.prototype.splice的参数一致
 * @param {Object=} option 设置参数
 * @param {boolean} option.silent 静默设置，不触发变更事件
 * @return {Array} 新数组
 */
Data.prototype.splice = function (expr, args, option) {
    option = option || {};
    expr = parseAccessor(expr, 'splice');
    return commitSplice(this, expr, args, option);
};

/**
 * 数组数据项push操作
 *
 * @param {string|Object} expr 数据项路径
 * @param {*} item 要push的值
 * @param {Object=} option 设置参数
 * @param {boolean} option.silent 静默设置，不触发变更事件
 * @return {number} 新数组的length属性
 */
Data.prototype.push = function (expr, item, option) {
    var target = this.get(expr);

    if (target instanceof Array) {
        commitSplice(this, parseAccessor(expr, 'push'), [target.length, 0, item], option);
        return target.length + 1;
    }
};

/**
 * 数组数据项pop操作
 *
 * @param {string|Object} expr 数据项路径
 * @param {Object=} option 设置参数
 * @param {boolean} option.silent 静默设置，不触发变更事件
 * @return {*}
 */
Data.prototype.pop = function (expr, option) {
    var target = this.get(expr);

    if (target instanceof Array) {
        var len = target.length;
        if (len) {
            return commitSplice(this, parseAccessor(expr, 'pop'), [len - 1, 1], option)[0];
        }
    }
};

/**
 * 数组数据项shift操作
 *
 * @param {string|Object} expr 数据项路径
 * @param {Object=} option 设置参数
 * @param {boolean} option.silent 静默设置，不触发变更事件
 * @return {*}
 */
Data.prototype.shift = function (expr, option) {
    var target = this.get(expr);

    if (target instanceof Array) {
        return commitSplice(this, parseAccessor(expr, 'shift'), [0, 1], option)[0];
    }
};

/**
 * 数组数据项unshift操作
 *
 * @param {string|Object} expr 数据项路径
 * @param {*} item 要unshift的值
 * @param {Object=} option 设置参数
 * @param {boolean} option.silent 静默设置，不触发变更事件
 * @return {number} 新数组的length属性
 */
Data.prototype.unshift = function (expr, item, option) {
    var target = this.get(expr);

    if (target instanceof Array) {
        commitSplice(this, parseAccessor(expr, 'unshift'), [0, 0, item], option);
        return target.length + 1;
    }
};

/**
 * 数组数据项移除操作
 *
 * @param {string|Object} expr 数据项路径
 * @param {number} index 要移除项的索引
 * @param {Object=} option 设置参数
 * @param {boolean} option.silent 静默设置，不触发变更事件
 */
Data.prototype.removeAt = function (expr, index, option) {
    commitSplice(this, parseAccessor(expr, 'removeAt'), [index, 1], option);
};

/**
 * 数组数据项移除操作
 *
 * @param {string|Object} expr 数据项路径
 * @param {*} value 要移除的项
 * @param {Object=} option 设置参数
 * @param {boolean} option.silent 静默设置，不触发变更事件
 */
Data.prototype.remove = function (expr, value, option) {
    var target = this.get(expr);

    if (target instanceof Array) {
        var len = target.length;
        while (len--) {
            if (target[len] === value) {
                commitSplice(this, parseAccessor(expr, 'remove'), [len, 1], option);
                break;
            }
        }
    }
};

exports = module.exports = Data;
