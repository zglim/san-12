/**
 * @file Node.js 环境下的验证测试
 *
 * 使用 jsdom 模拟浏览器环境，验证重构后的 node factory
 * 在普通创建、hydrate、动态组件、fragment/template、render-only
 * 等关键路径下的行为。
 */

var jsdom = require('jsdom');
var JSDOM = jsdom.JSDOM;

// 设置全局 DOM 对象
var dom = new JSDOM('<!DOCTYPE html><html><body></body></html>');
global.window = dom.window;
global.document = dom.window.document;
global.navigator = dom.window.navigator;
global.HTMLElement = dom.window.HTMLElement;
global.Node = dom.window.Node;
global.Comment = dom.window.Comment;
global.Text = dom.window.Text;

var san = require('../dist/san');

var passed = 0;
var failed = 0;
var total = 0;

function assert(condition, msg) {
    total++;
    if (condition) {
        passed++;
        console.log('  \x1b[32m✓\x1b[0m ' + msg);
    } else {
        failed++;
        console.log('  \x1b[31m✗\x1b[0m ' + msg);
    }
}

function section(name) {
    console.log('\n\x1b[1m' + name + '\x1b[0m');
}

// ================================================================
section('1. 普通创建路径 (createNode -> resolveComponent)');
// ================================================================

(function () {
    var MyComponent = san.defineComponent({
        template: '<div><span>hello</span></div>'
    });
    var myComponent = new MyComponent();

    var wrap = document.createElement('div');
    myComponent.attach(wrap);

    assert(
        wrap.querySelector('span') && wrap.querySelector('span').textContent === 'hello',
        'element with plain tag renders correctly'
    );

    myComponent.dispose();
})();

(function () {
    var Inner = san.defineComponent({
        template: '<b>{{text}}</b>'
    });
    var Outer = san.defineComponent({
        components: {'x-inner': Inner},
        template: '<div><x-inner text="{{msg}}"/></div>'
    });
    var myComponent = new Outer({data: {msg: 'world'}});

    var wrap = document.createElement('div');
    myComponent.attach(wrap);

    assert(
        wrap.querySelector('b') && wrap.querySelector('b').textContent === 'world',
        'nested child components via owner.components'
    );

    myComponent.dispose();
})();

(function () {
    var MyComponent = san.defineComponent({
        template: '<div><span s-if="show">visible</span><span s-else>hidden</span></div>'
    });
    var myComponent = new MyComponent({data: {show: false}});

    var wrap = document.createElement('div');
    myComponent.attach(wrap);

    var spans = wrap.querySelectorAll('span');
    assert(
        spans.length === 1 && spans[0].textContent === 'hidden',
        'if-node creates correct branch (else)'
    );

    myComponent.dispose();
})();

(function () {
    var MyComponent = san.defineComponent({
        template: '<ul><li s-for="item in list">{{item}}</li></ul>'
    });
    var myComponent = new MyComponent({data: {list: ['a', 'b', 'c']}});

    var wrap = document.createElement('div');
    myComponent.attach(wrap);

    var lis = wrap.querySelectorAll('li');
    assert(
        lis.length === 3 && lis[0].textContent === 'a' && lis[2].textContent === 'c',
        'for-node creates children on attach'
    );

    myComponent.dispose();
})();


// ================================================================
section('2. 动态组件路径 (s-is / IsNode)');
// ================================================================

(function () {
    var LabelA = san.defineComponent({
        template: '<a>label-a</a>'
    });
    var LabelB = san.defineComponent({
        template: '<b>label-b</b>'
    });
    var MyComponent = san.defineComponent({
        components: {'x-a': LabelA, 'x-b': LabelB},
        template: '<div><x-base s-is="cmptName"/></div>'
    });
    var myComponent = new MyComponent({data: {cmptName: 'x-a'}});

    var wrap = document.createElement('div');
    myComponent.attach(wrap);

    assert(
        wrap.querySelector('a') && wrap.querySelector('a').textContent === 'label-a',
        's-is resolves to registered component (x-a)'
    );

    myComponent.dispose();
})();

(function () {
    var MyComponent = san.defineComponent({
        template: '<div><x-base s-is="\'fragment\'"><span>a</span><span>b</span></x-base></div>'
    });
    var myComponent = new MyComponent();

    var wrap = document.createElement('div');
    myComponent.attach(wrap);

    var spans = wrap.querySelectorAll('span');
    assert(
        spans.length === 2,
        's-is with fragment renders FragmentNode with 2 children'
    );

    myComponent.dispose();
})();


// ================================================================
section('3. fragment / template 路径');
// ================================================================

(function () {
    var MyComponent = san.defineComponent({
        template: '<fragment>see <a href="{{link}}">{{linkText}}</a></fragment>'
    });
    var myComponent = new MyComponent({
        data: {link: 'http://example.com', linkText: 'click'}
    });

    var wrap = document.createElement('div');
    myComponent.attach(wrap);

    var a = wrap.querySelector('a');
    assert(
        a !== null && a.textContent === 'click' && a.getAttribute('href') === 'http://example.com',
        'fragment as component root renders correctly'
    );

    myComponent.dispose();
})();

(function () {
    var MyComponent = san.defineComponent({
        template: '<fragment s-if="!hidden"><b>visible</b></fragment>'
    });
    var myComponent = new MyComponent({data: {hidden: false}});

    var wrap = document.createElement('div');
    myComponent.attach(wrap);

    assert(
        wrap.querySelector('b') !== null && wrap.querySelector('b').textContent === 'visible',
        'fragment with s-if as component root'
    );

    myComponent.dispose();
})();

(function () {
    var Tpl = san.defineTemplateComponent({
        template: '<div class="wrapper"><slot/></div>'
    });
    var MyComponent = san.defineComponent({
        components: {'x-tpl': Tpl},
        template: '<div><x-tpl><span>inside</span></x-tpl></div>'
    });
    var myComponent = new MyComponent();

    var wrap = document.createElement('div');
    myComponent.attach(wrap);

    assert(
        wrap.querySelector('.wrapper') !== null && wrap.querySelector('span') !== null,
        'template component with slot renders correctly'
    );

    myComponent.dispose();
})();


// ================================================================
section('4. Hydrate 反解路径');
// ================================================================

(function () {
    var MyComponent = san.defineComponent({
        template: '<div><span title="{{name}}">{{name}}</span></div>'
    });

    var wrap = document.createElement('div');
    wrap.innerHTML = '<div><span title="erik">erik</span></div>';

    var myComponent = new MyComponent({
        el: wrap.firstChild
    });

    assert(
        myComponent.el && myComponent.el.tagName === 'DIV',
        'basic element hydrate: root element found'
    );

    var span = myComponent.el.querySelector('span');
    assert(
        span !== null && span.getAttribute('title') === 'erik' && span.textContent === 'erik',
        'basic element hydrate: child content preserved'
    );

    myComponent.dispose();
})();

(function () {
    var Inner = san.defineComponent({
        template: '<b>{{text}}</b>'
    });
    var Outer = san.defineComponent({
        components: {'x-inner': Inner},
        template: '<div><x-inner text="{{msg}}"/></div>'
    });

    // First render to get SSR-like HTML
    var src = new Outer({data: {msg: 'hi'}});
    var wrap = document.createElement('div');
    src.attach(wrap);
    var html = wrap.innerHTML;
    src.dispose();

    // Now hydrate from that HTML
    wrap.innerHTML = html;
    var myComponent = new Outer({
        el: wrap.firstChild,
        data: {msg: 'hi'}
    });

    assert(
        myComponent.el !== null,
        'hydrate with child component: root found'
    );

    var b = myComponent.el.querySelector('b');
    assert(
        b !== null && b.textContent === 'hi',
        'hydrate with child component: content preserved'
    );

    myComponent.dispose();
})();

(function () {
    var MyComponent = san.defineComponent({
        template: '<div><span s-if="show">visible</span></div>'
    });

    // Render first
    var src = new MyComponent({data: {show: true}});
    var wrap = document.createElement('div');
    src.attach(wrap);
    var html = wrap.innerHTML;
    src.dispose();

    // Hydrate
    wrap.innerHTML = html;
    var myComponent = new MyComponent({
        el: wrap.firstChild,
        data: {show: true}
    });

    var span = myComponent.el.querySelector('span');
    assert(
        span !== null && span.textContent === 'visible',
        'hydrate if-true branch'
    );

    myComponent.dispose();
})();

(function () {
    var MyComponent = san.defineComponent({
        template: '<ul><li s-for="item in list">{{item}}</li></ul>'
    });

    // Render
    var src = new MyComponent({data: {list: ['x', 'y']}});
    var wrap = document.createElement('div');
    src.attach(wrap);
    var html = wrap.innerHTML;
    src.dispose();

    // Hydrate
    wrap.innerHTML = html;
    var myComponent = new MyComponent({
        el: wrap.firstChild,
        data: {list: ['x', 'y']}
    });

    var lis = myComponent.el.querySelectorAll('li');
    assert(
        lis.length === 2,
        'hydrate for-list preserves items'
    );

    myComponent.dispose();
})();


// ================================================================
section('5. render-only SSR hydrate');
// ================================================================

(function () {
    var Inner = san.defineComponent({
        template: '<b>{{text}}</b>'
    });
    var Outer = san.defineComponent({
        components: {'x-inner': Inner},
        template: '<div><x-inner text="hello"/></div>'
    });

    // Simulate render-only SSR output
    var outerDiv = document.createElement('div');
    outerDiv.setAttribute('data-sanssr', 'render-only');

    var innerB = document.createElement('b');
    innerB.setAttribute('data-sanssr-cmpt', 'x-inner');
    innerB.textContent = 'hello';

    var innerDiv = document.createElement('div');
    innerDiv.appendChild(innerB);
    outerDiv.appendChild(innerDiv);

    var result = san.hydrateComponent(Outer, {el: outerDiv});

    assert(
        result.renderOnly === true,
        'render-only hydrate: renderOnly flag set'
    );
    assert(
        result.components !== undefined && result.components['x-inner'] !== undefined,
        'render-only hydrate: components map populated'
    );
    assert(
        result.components['x-inner'] && result.components['x-inner'].length === 1,
        'render-only hydrate: component instance created'
    );
})();


// ================================================================
section('6. Slot 路径');
// ================================================================

(function () {
    var Child = san.defineComponent({
        template: '<div class="child"><slot/></div>'
    });
    var Parent = san.defineComponent({
        components: {'x-child': Child},
        template: '<div><x-child><span>from parent</span></x-child></div>'
    });
    var myComponent = new Parent();

    var wrap = document.createElement('div');
    myComponent.attach(wrap);

    assert(
        wrap.querySelector('.child') !== null,
        'slot: child wrapper renders'
    );
    assert(
        wrap.querySelector('span') !== null && wrap.querySelector('span').textContent === 'from parent',
        'slot: default slot content from parent'
    );

    myComponent.dispose();
})();


// ================================================================
section('7. 错误路径保留');
// ================================================================

(function () {
    var MyComponent = san.defineComponent({
        template: '<div s-html="content"></div>'
    });

    var wrap = document.createElement('div');
    wrap.innerHTML = '<div><b>pre-rendered</b></div>';

    var threw = false;
    try {
        var myComponent = new MyComponent({
            el: wrap.firstChild,
            data: {content: '<b>pre-rendered</b>'}
        });
        assert(myComponent.el !== null, 'html directive: hydrate without error');
        myComponent.dispose();
    } catch (e) {
        threw = true;
    }
    assert(!threw, 'html directive: no exception during hydrate');
})();


// ================================================================
// Summary
// ================================================================

console.log('\n\x1b[1m=== Summary ===\x1b[0m');
console.log('Total:  ' + total);
console.log('\x1b[32mPassed: ' + passed + '\x1b[0m');
if (failed > 0) {
    console.log('\x1b[31mFailed: ' + failed + '\x1b[0m');
}
console.log('');

process.exit(failed > 0 ? 1 : 0);
