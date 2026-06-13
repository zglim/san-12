/**
 * @file node factory 重构测试
 *
 * 覆盖普通创建、hydrate 反解、动态组件（s-is）、fragment / template、
 * render-only hydrate 等关键路径，确保 resolve-component /
 * hydrate-fragment-boundary / resolve-parent-component 等公共模块
 * 在各种边界条件下行为正确。
 */

describe("NodeFactory", function () {

    // ================================================================
    // 1. 普通创建路径（createNode -> resolveComponent）
    // ================================================================

    describe("normal create", function () {

        it("element with plain tag", function () {
            var MyComponent = san.defineComponent({
                template: '<div><span>hello</span></div>'
            });
            var myComponent = new MyComponent();

            var wrap = document.createElement('div');
            myComponent.attach(wrap);

            expect(wrap.querySelector('span').textContent).toBe('hello');

            myComponent.dispose();
        });

        it("nested child components via owner.components", function () {
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

            expect(wrap.querySelector('b').textContent).toBe('world');

            myComponent.dispose();
        });

        it("if-node creates correct branch on attach", function () {
            var MyComponent = san.defineComponent({
                template: '<div><span s-if="show">visible</span><span s-else>hidden</span></div>'
            });
            var myComponent = new MyComponent({data: {show: false}});

            var wrap = document.createElement('div');
            myComponent.attach(wrap);

            var spans = wrap.querySelectorAll('span');
            expect(spans.length).toBe(1);
            expect(spans[0].textContent).toBe('hidden');

            myComponent.dispose();
        });

        it("for-node creates children on attach", function () {
            var MyComponent = san.defineComponent({
                template: '<ul><li s-for="item in list">{{item}}</li></ul>'
            });
            var myComponent = new MyComponent({data: {list: ['a', 'b', 'c']}});

            var wrap = document.createElement('div');
            myComponent.attach(wrap);

            var lis = wrap.querySelectorAll('li');
            expect(lis.length).toBe(3);
            expect(lis[0].textContent).toBe('a');
            expect(lis[2].textContent).toBe('c');

            myComponent.dispose();
        });

        it("text node with original (html) expression", function () {
            var MyComponent = san.defineComponent({
                template: '<div>{{{raw}}}</div>'
            });
            var myComponent = new MyComponent({data: {raw: '<b>bold</b>'}});

            var wrap = document.createElement('div');
            myComponent.attach(wrap);

            expect(wrap.querySelector('b')).not.toBe(null);
            expect(wrap.querySelector('b').textContent).toBe('bold');

            myComponent.dispose();
        });
    });


    // ================================================================
    // 2. 动态组件路径（s-is / IsNode）
    // ================================================================

    describe("dynamic component (s-is)", function () {

        it("s-is resolves to a registered component", function () {
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

            expect(wrap.querySelector('a')).not.toBe(null);
            expect(wrap.querySelector('a').textContent).toBe('label-a');

            myComponent.dispose();
        });

        it("s-is switches component when value changes", function (done) {
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

            expect(wrap.querySelector('a')).not.toBe(null);

            myComponent.data.set('cmptName', 'x-b');
            san.nextTick(function () {
                expect(wrap.querySelector('b')).not.toBe(null);
                expect(wrap.querySelector('b').textContent).toBe('label-b');
                expect(wrap.querySelector('a')).toBe(null);

                myComponent.dispose();
                done();
            });
        });

        it("s-is with fragment/template renders FragmentNode", function () {
            var MyComponent = san.defineComponent({
                template: '<div><x-base s-is="\'fragment\'"><span>a</span><span>b</span></x-base></div>'
            });
            var myComponent = new MyComponent();

            var wrap = document.createElement('div');
            myComponent.attach(wrap);

            var spans = wrap.querySelectorAll('span');
            expect(spans.length).toBe(2);

            myComponent.dispose();
        });

        it("s-is in for loop", function (done) {
            var XA = san.defineComponent({template: '<a>{{title}}</a>'});
            var XB = san.defineComponent({template: '<b>{{title}}</b>'});
            var Parent = san.defineComponent({
                components: {'x-a': XA, 'x-b': XB},
                template: '<div>'
                    + '<x-what s-for="item in list" s-is="\'x-\' + item.type">{{item.title}}</x-what>'
                    + '</div>'
            });

            var myComponent = new Parent({
                data: {
                    list: [
                        {type: 'a', title: 'Alpha'},
                        {type: 'b', title: 'Beta'}
                    ]
                }
            });

            var wrap = document.createElement('div');
            myComponent.attach(wrap);

            san.nextTick(function () {
                expect(wrap.querySelector('a')).not.toBe(null);
                expect(wrap.querySelector('b')).not.toBe(null);
                expect(wrap.querySelector('a').textContent).toBe('Alpha');
                expect(wrap.querySelector('b').textContent).toBe('Beta');

                myComponent.dispose();
                done();
            });
        });
    });


    // ================================================================
    // 3. fragment / template 路径
    // ================================================================

    describe("fragment / template", function () {

        it("fragment as component root", function (done) {
            var MyComponent = san.defineComponent({
                template: '<fragment>see <a href="{{link}}">{{linkText}}</a></fragment>'
            });
            var myComponent = new MyComponent({
                data: {link: 'http://example.com', linkText: 'click'}
            });

            var wrap = document.createElement('div');
            myComponent.attach(wrap);

            san.nextTick(function () {
                var a = wrap.querySelector('a');
                expect(a).not.toBe(null);
                expect(a.textContent).toBe('click');
                expect(a.getAttribute('href')).toBe('http://example.com');

                myComponent.dispose();
                done();
            });
        });

        it("fragment with s-if as component root", function (done) {
            var MyComponent = san.defineComponent({
                template: '<fragment s-if="!hidden"><b>visible</b></fragment>'
            });
            var myComponent = new MyComponent({data: {hidden: false}});

            var wrap = document.createElement('div');
            myComponent.attach(wrap);

            san.nextTick(function () {
                expect(wrap.querySelector('b')).not.toBe(null);
                expect(wrap.querySelector('b').textContent).toBe('visible');

                myComponent.dispose();
                done();
            });
        });

        it("template component with slot", function (done) {
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

            san.nextTick(function () {
                expect(wrap.querySelector('.wrapper')).not.toBe(null);
                expect(wrap.querySelector('span').textContent).toBe('inside');

                myComponent.dispose();
                done();
            });
        });
    });


    // ================================================================
    // 4. Hydrate 反解路径
    // ================================================================

    describe("hydrate", function () {

        it("basic element hydrate", function () {
            var MyComponent = san.defineComponent({
                template: '<div><span title="{{name}}">{{name}}</span></div>'
            });

            var wrap = document.createElement('div');
            wrap.innerHTML = '<div><span title="erik">erik</span></div>';

            var myComponent = new MyComponent({
                el: wrap.firstChild
            });

            expect(myComponent.el.tagName).toBe('DIV');
            var span = myComponent.el.querySelector('span');
            expect(span).not.toBe(null);
            expect(span.getAttribute('title')).toBe('erik');
            expect(span.textContent).toBe('erik');

            myComponent.dispose();
        });

        it("hydrate with child component", function () {
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

            expect(myComponent.el).not.toBe(null);
            var b = myComponent.el.querySelector('b');
            expect(b).not.toBe(null);
            expect(b.textContent).toBe('hi');

            myComponent.dispose();
        });

        it("hydrate if-true branch", function () {
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

            expect(myComponent.el).not.toBe(null);
            var span = myComponent.el.querySelector('span');
            expect(span).not.toBe(null);
            expect(span.textContent).toBe('visible');

            myComponent.dispose();
        });

        it("hydrate for-list", function () {
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

            expect(myComponent.el).not.toBe(null);
            var lis = myComponent.el.querySelectorAll('li');
            expect(lis.length).toBe(2);

            myComponent.dispose();
        });

        it("hydrate with s-is dynamic component", function () {
            var LabelA = san.defineComponent({
                template: '<a>{{text}}</a>'
            });
            var MyComponent = san.defineComponent({
                components: {'x-a': LabelA},
                template: '<div><x-base s-is="cmptName" text="{{msg}}"/></div>'
            });

            // Render
            var src = new MyComponent({data: {cmptName: 'x-a', msg: 'hi'}});
            var wrap = document.createElement('div');
            src.attach(wrap);
            var html = wrap.innerHTML;
            src.dispose();

            // Hydrate
            wrap.innerHTML = html;
            var myComponent = new MyComponent({
                el: wrap.firstChild,
                data: {cmptName: 'x-a', msg: 'hi'}
            });

            expect(myComponent.el).not.toBe(null);

            myComponent.dispose();
        });
    });


    // ================================================================
    // 5. render-only SSR hydrate
    // ================================================================

    describe("render-only hydrate", function () {

        it("data-sanssr=render-only triggers render-only path", function () {
            var Inner = san.defineComponent({
                template: '<b>{{text}}</b>'
            });
            var Outer = san.defineComponent({
                components: {'x-inner': Inner},
                template: '<div><x-inner text="hello"/></div>'
            });

            // Simulate render-only SSR output
            var wrap = document.createElement('div');
            var outerDiv = document.createElement('div');
            outerDiv.setAttribute('data-sanssr', 'render-only');

            var innerB = document.createElement('b');
            innerB.setAttribute('data-sanssr-cmpt', 'x-inner');
            innerB.textContent = 'hello';

            var innerDiv = document.createElement('div');
            innerDiv.appendChild(innerB);
            outerDiv.appendChild(innerDiv);
            wrap.appendChild(outerDiv);

            // hydrateComponent should return renderOnly: true
            var result = san.hydrateComponent(Outer, {el: outerDiv});
            expect(result.renderOnly).toBe(true);
            expect(result.components).toBeDefined();
            expect(result.components['x-inner']).toBeDefined();
            expect(result.components['x-inner'].length).toBe(1);
        });
    });


    // ================================================================
    // 6. 异步组件路径
    // ================================================================

    describe("async component (ComponentLoader)", function () {

        it("loader resolves and renders", function (done) {
            var RealComponent = san.defineComponent({
                template: '<b>{{text}}</b>'
            });

            var loader = san.createComponentLoader(function (load) {
                setTimeout(function () {
                    load(RealComponent);
                }, 10);
            });

            var MyComponent = san.defineComponent({
                components: {'x-async': loader},
                template: '<div><x-async text="loaded"/></div>'
            });
            var myComponent = new MyComponent();

            var wrap = document.createElement('div');
            myComponent.attach(wrap);

            setTimeout(function () {
                expect(wrap.querySelector('b')).not.toBe(null);
                expect(wrap.querySelector('b').textContent).toBe('loaded');

                myComponent.dispose();
                done();
            }, 100);
        });

        it("loader with placeholder", function (done) {
            var Placeholder = san.defineComponent({
                template: '<span>loading...</span>'
            });
            var RealComponent = san.defineComponent({
                template: '<b>done</b>'
            });

            var loader = san.createComponentLoader({
                load: function (load) {
                    setTimeout(function () {
                        load(RealComponent);
                    }, 50);
                },
                placeholder: Placeholder
            });

            var MyComponent = san.defineComponent({
                components: {'x-async': loader},
                template: '<div><x-async/></div>'
            });
            var myComponent = new MyComponent();

            var wrap = document.createElement('div');
            myComponent.attach(wrap);

            // Placeholder should be visible initially
            expect(wrap.querySelector('span')).not.toBe(null);
            expect(wrap.querySelector('span').textContent).toBe('loading...');

            setTimeout(function () {
                // After loading, real component should replace placeholder
                expect(wrap.querySelector('b')).not.toBe(null);
                expect(wrap.querySelector('b').textContent).toBe('done');

                myComponent.dispose();
                done();
            }, 200);
        });
    });


    // ================================================================
    // 7. slot-node 路径
    // ================================================================

    describe("slot node", function () {

        it("default slot renders children from parent", function (done) {
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

            san.nextTick(function () {
                expect(wrap.querySelector('.child')).not.toBe(null);
                expect(wrap.querySelector('span').textContent).toBe('from parent');

                myComponent.dispose();
                done();
            });
        });

        it("named slot", function (done) {
            var Child = san.defineComponent({
                template: '<div><slot name="header"/><slot/></div>'
            });
            var Parent = san.defineComponent({
                components: {'x-child': Child},
                template: '<div><x-child>'
                    + '<b slot="header">Title</b>'
                    + '<span>Body</span>'
                    + '</x-child></div>'
            });
            var myComponent = new Parent();

            var wrap = document.createElement('div');
            myComponent.attach(wrap);

            san.nextTick(function () {
                var b = wrap.querySelector('b');
                var span = wrap.querySelector('span');
                expect(b).not.toBe(null);
                expect(b.textContent).toBe('Title');
                expect(span).not.toBe(null);
                expect(span.textContent).toBe('Body');

                myComponent.dispose();
                done();
            });
        });
    });


    // ================================================================
    // 8. 错误路径保留
    // ================================================================

    describe("error messages preserved", function () {

        it("hydrateElementChildren: html directive skips child hydrate", function () {
            var MyComponent = san.defineComponent({
                template: '<div s-html="content"></div>'
            });

            var wrap = document.createElement('div');
            wrap.innerHTML = '<div><b>pre-rendered</b></div>';

            // Should not throw even though inner DOM doesn't match template children
            var myComponent = new MyComponent({
                el: wrap.firstChild,
                data: {content: '<b>pre-rendered</b>'}
            });

            expect(myComponent.el).not.toBe(null);

            myComponent.dispose();
        });
    });
});
