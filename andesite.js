"use strict";
if (!Object.prototype.forEach) {
    Object.prototype.forEach = function(cb) {
        Object.entries(this).forEach(cb);
    };
}

if (!Array.prototype.flatMap) {
    Array.prototype.flatMap = function(mapper) {
        let subElems = [];
        this.map(elem => mapper(elem))
            .filter(col => !!col)
            .forEach(col => $a.filter(col, subElem => !!subElem).forEach(subElem => subElems.push(subElem)));
        return subElems;
    };
}

class _Selector extends Array {

    constructor(data) {
        super();
        if (typeof(data) === "string")
            document.querySelectorAll(data).forEach(elem => this.push(elem));
        else if (data instanceof Array)
            data.forEach(elem => this.push(elem));
        else if (data instanceof Element || data instanceof Document || data instanceof DocumentFragment)
            this.push(data);
    }

    filter(filter) {
        return typeof(selector) === "string"
            ? this.filter(elem => elem.matches(selector))
            : $(super.filter(filter));
    }

    get first() {
        return this[0];
    }

    get children() {
        return $(this.flatMap(elem => elem.children));
    }

    get parent() {
        return $(this.first.parentElement);
    }

    find(selector) {
        return $(this.flatMap(elem => elem.querySelectorAll(selector)));
    }

    on(event, cb) {
        this.forEach(elem => elem.addEventListener(event, cb));
    }

    get value() { // TODO More comprehensive switch
        switch (this.first.getAttribute("type").toLowerCase()) {
            case "checkbox":
                return this.first.checked;
            default:
                return this.first.value;
        }
    }

    set value(val) {
        switch (this.first.getAttribute("type").toLowerCase()) {
            case "checkbox":
                this.first.checked = val;
                break;
            default:
                this.first.value = val;
                break;
        }
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
        let nestedHandler = () => ({
            get: (target, name) => {
                return target[name] instanceof Object
                    ? new Proxy(target[name], nestedHandler())
                    : target[name];
            },
            set: (target, name, val) => {
                target[name] = val;
                this._domUpdate();
                return true;
            }
        });
        this.data = new Proxy(this._dataBacking, nestedHandler());
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
                    let segs = _StandardComponent.parseInterpolators(child.nodeValue);
                    if (!!segs)
                        this._targets.push({type: 0, elem: child, segs: segs});
                } else if (child.nodeType === 1 && child.nodeName === "A-FOREACH") {
                    this._targets.push({type: 3, elem: child});
                } else if (!!child.attributes) {
                    $a.filter(child.attributes, attr => !attr.name.startsWith("a-")).forEach(attr => {
                        let segs = _StandardComponent.parseInterpolators(attr.value);
                        if (!!segs)
                            this._targets.push({type: 1, elem: child, name: attr.name, segs: segs});
                    });
                    let attrVal;
                    if (!!(attrVal = child.getAttribute("a-bind"))) {
                        let setter = this._setterFor(attrVal);
                        let childSel = $(child);
                        childSel.on("input", () => setter(childSel.value));
                        childSel.on("change", () => setter(childSel.value));
                        setter(childSel.value);
                        this._targets.push({type: 2, elem: $(child), prop: attrVal});
                    }
                }
                parseTree(child);
            });
        };
        parseTree(this._shadow);
        $(this._shadow).find("script")
            .filter(elem => !!elem.innerText.trim())
            .forEach(elem => this._runScript(elem.innerText));
    }

    _domUpdate() {
        let props = {};
        this._attrBacking.forEach(e => props["attr." + e[0]] = e[1]);
        let addToProps = (elem, root) => {
            if (elem[1] instanceof Object)
                elem[1].forEach(subElem => addToProps(subElem, elem[0] + "."));
            else
                props[root + elem[0]] = elem[1];
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
                case 2:
                    target.elem.value = props[target.prop];
                    break;
                case 3:
                    target.elem.update(this._dataBacking);
                    break;
            }
        });
    }

    _setterFor(varName) {
        if (varName.startsWith("attr.")) {
            varName = varName.substring(5);
            return val => this.attr[varName] = val;
        }
        let segs = varName.split(".");
        let obj = this.data;
        for (let i = 0; i < segs.length - 1; i++) {
            if (!(segs[i] in obj))
                obj[segs[i]] = {};
            obj = obj[segs[i]];
        }
        varName = segs[segs.length - 1];
        return val => obj[varName] = val;
    }

    _runScript(script) {
        let $ = selector => typeof(selector) === "string" ? $a.query(this._shadow).find(selector) : $a.query(selector);
        eval(script);
    }

    static parseInterpolators(str) {
        let segs = [];
        let match = null;
        while ((match = str.match(_StandardComponent._propPattern)) !== null) {
            if (match.index > 0) {
                let preMatch = str.substring(0, match.index);
                segs.push(vals => preMatch);
            }
            let varName = match[1];
            let provider = vals => varName in vals ? vals[varName] : "!{" + varName + "}";
            provider.isVar = true;
            segs.push(provider);
            str = str.substring(match.index + match[0].length);
        }
        if (!!str)
            segs.push(vals => str);
        return (segs.length < 1 || (segs.length === 1 && !segs[0].isVar)) ? null : segs;
    }

}

class _IterationComponent extends HTMLElement {

    constructor() {
        super();
        this._data = {};
        this._src = this.getAttribute("a-in");
        this._template = _StandardComponent.parseInterpolators(super.innerHTML);
        this._domUpdate();
    }

    update(obj) {
        let segs = this._src.split(".");
        for (let i = 0; i < segs.length - 1; i++) {
            if (!(segs[i] in obj))
                obj[segs[i]] = {};
            obj = obj[segs[i]];
        }
        this._data = obj[segs[segs.length - 1]];
        this._domUpdate();
    }

    _domUpdate() {
        this.innerHTML = "";
        this._data.forEach(elem => {
            let props = {};
            let addToProps = (elem, root) => {
                if (elem[1] instanceof Object)
                    elem[1].forEach(subElem => addToProps(subElem, elem[0] + "."));
                else
                    props[root + elem[0]] = elem[1];
            };
            elem.forEach(prop => addToProps(prop, ""));
            this.innerHTML += this._template.map(seg => seg(props)).join("");
        });
    }

}

_StandardComponent._propPattern = /\${([$A-Z_][0-9A-Z_$.]*)}/i;

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
        this.query = $;
        this._readyHandlers = [];
        this._componentRegistry = [];
        this._importRegistry = {};
        customElements.define("a-foreach", _IterationComponent);
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

    filter(collection, predicate) {
        let col = [];
        $a.forEach(collection, elem => {
            if (predicate(elem))
                col.push(elem);
        });
        return col;
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