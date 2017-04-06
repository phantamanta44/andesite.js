"use strict";
if (!Object.prototype.forEach) {
    Object.prototype.forEach = function(cb) {
        Object.entries(this).forEach(cb);
    };
}

if (!Array.prototype.flatMap) {
    Array.prototype.flatMap = function(mapper) {
        let children = [];
        this.map(elem => mapper(elem))
            .filter(elem => !!elem)
            .forEach(elem => elem.forEach(children.push));
        return children;
    };
}

class _Selector extends Array {

    constructor(data) {
        super();
        if (typeof(data) === "string")
            document.querySelectorAll(data).forEach(elem => this.push(elem));
        else if (data instanceof Array)
            data.forEach(this.push);
        else if (data instanceof Element)
            this.push(data);
    }

    filter(filter) {
        return $(super.filter(filter));
    }

    find(selector) {
        return this.filter(elem => elem.matches(selector));
    }

    get first() {
        return this[0];
    }

    get children() {
        return $(this.flatMap(elem => elem.children));
    }

    search(selector) {
        return $(this.flatMap(elem => elem.querySelectorAll(selector)));
    }

    on(event, cb) {
        this.forEach(elem => elem.addEventListener(event, cb));
    }

}

function $(selector) {
    return new Proxy(new _Selector(selector), {
        get: (target, name) => name in target ? target[name] : target.first[name],
        set: (target, name, val) => {
            if (name in target)
                target[name] = val;
            else
                target.first[name] = val;
            return true;
        }
    });
}

class _StandardComponent extends HTMLElement {

    constructor() {
        super();
        this._attrBacking = {};
        this.attr = new Proxy(this._attrBacking, {
            set: (target, name, val) => {
                target[name] = val;
                super.setAttribute(name, val);
                this._domUpdate();
                return true;
            }
        });
        this._observer = new MutationObserver(() => {
            this._populateAttributes();
            this._domUpdate();
        });
        this._observer.observe(this, {attributes: true, characterData: true, childList: true});
        this._dataBacking = {};
        this.data = new Proxy(this._dataBacking, {
            set: (target, name, val) => {
                target[name] = val;
                this._domUpdate();
                return true;
            }
        });
        this._populateAttributes();
        this._shadow = null;
        this._targets = null;
        this._domInit();
        this._domUpdate();
    }

    _populateAttributes() {
        $a.forEach(this.attributes, entry => this._attrBacking[entry.name] = entry.value);
        this._dataBacking.param = super.innerHTML;
    }

    setAttribute(name, val) {
        this.attr[name] = val;
    }

    set innerHTML(val) {
        super.innerHTML = val;
        this.data.param = val;
    }

    get innerHTML() {
        return this.data.param;
    }

    set id(val) {
        this.attr.id = val;
    }

    get id() {
        return this.attr.id;
    }

    _domInit() {
        this._shadow = this.attachShadow({mode: "closed"});
        this._shadow.innerHTML = $a._importRegistry[this.tagName.toLowerCase()];
        this._targets = [];
        let parseTree = parent => {
            parent.childNodes.forEach(child => {
                if (child.nodeType === 3) {
                    let segs = _StandardComponent._parseInterpolators(child.nodeValue);
                    if (!!segs)
                        this._targets.push({type: 0, elem: child, segs: segs});
                } else if (!!child.attributes) {
                    $a.forEach(child.attributes, attr => {
                        let segs = _StandardComponent._parseInterpolators(attr.value);
                        if (!!segs)
                            this._targets.push({type: 1, elem: child, name: attr.name, segs: segs});
                    });
                }
                parseTree(child);
            });
        };
        parseTree(this._shadow);
        $(this._shadow).search("script")
            .filter(elem => !!elem.innerText.trim())
            .forEach(elem => _StandardComponent._runScript.call(elem, elem.innerText));
    }

    _domUpdate() {
        let props = {};
        this._attrBacking.forEach(e => props["attr." + e[0]] = e[1]);
        let addToProps = (elem, root) => {
            if (elem[1] instanceof Object)
                elem[1].forEach(subElem => addToProps(subElem, elem[0] + "."));
            else
                props[elem[0]] = elem[1];
        };
        this._dataBacking.forEach(elem => addToProps(elem, ""));
        let resolve = target => target.segs.map(seg => seg(props)).join("");
        this._targets.forEach(target => {
            switch (target.type) {
                case 0:
                    target.elem.nodeValue = resolve(target);
                    break;
                case 1:
                    target.elem.setAttribute(target.name, resolve(target));
                    break;
            }
        });
    }

    static _parseInterpolators(str) {
        let segs = [];
        let match = null;
        while ((match = str.match(_StandardComponent._propPattern)) !== null) {
            if (match.index > 0) {
                let preMatch = str.substring(0, match.index);
                segs.push(vals => preMatch);
            }
            let varName = match[1];
            let provider = vals => vals[varName] || "!{" + varName + "}";
            provider.isVar = true;
            segs.push(provider);
            str = str.substring(match.index + match[0].length);
        }
        if (!!str)
            segs.push(vals => str);
        return (segs.length < 1 || (segs.length == 1 && !segs[0].isVar)) ? null : segs;
    }

    static _runScript(script) {
        console.log("Running: " + script);
        eval(script);
    }

}

_StandardComponent._propPattern = /\${([$A-Z_][0-9A-Z_$.]*)}/i

class _MessageBus {

    constructor() {
        this._listeners = {};
    }

    on(msgType, cb) {
        if (msgType in this._listeners)
            this._listeners[msgType].push(cb);
        else
            this._listeners[msgType] = [cb];
    }

    post(msg) {
        if (!!msg.type && msg.type in this._listeners)
            this._listeners[msg.type].forEach(listener => listener(msg));
    }

}

class _AndesiteInstance {

    constructor() {
        this.msgBus = new _MessageBus();
        this._readyHandlers = [];
        this._componentRegistry = [];
        this._importRegistry = {};
    }

    component(componentName) {
        $a.forEach(arguments, name => {
            let id = "a-" + name;
            $a.ajax("static/component/" + name + ".html", doc => {
                this._importRegistry[id] = doc;
                customElements.define(id, class extends _StandardComponent {
                    constructor() {
                        super();
                    }
                });
                this._componentRegistry.push(id);
            });
        });
    }

    ready(cb) {
        if (document.readyState === "loading")
            this._readyHandlers.push(cb);
        else
            cb();
    }

    _ready() {
        this._readyHandlers.forEach(handler => handler());
    }

    forEach(collection, cb) {
        let length = collection.length;
        for (let i = 0; i < length; i++)
            cb(collection[i]);
    }

    ajax(url, cb) {
        let req = new XMLHttpRequest();
        req.open("GET", url, true);
        req.onload = () => cb(req.status >= 200 && req.status < 400 ? req.responseText : null);
        req.send();
    }

}

const $a = new _AndesiteInstance();

if (document.readyState !== "loading")
    $a._ready();
else
    document.addEventListener("DOMContentLoaded", () => $a._ready());