"use strict";
if (!Object.prototype.forEach) {
    Object.prototype.forEach = function(cb) {
        Object.entries(this).forEach(cb);
    };
}

class _Selector extends Array {

    constructor(selector) {
        super();
        this.selector = selector;
        this._updateElems();
    }

    get selector() {
        return this.selector;
    }

    set selector(val) {
        this.selector = val;
        this._updateElems;
    }

    _updateElems() {
        this.length = 0;
        document.querySelectorAll(this.selector).forEach(elem => this.push(elem));
    }

    get first() {
        return this[0];
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
        this._observer = new MutationObserver((m) => {
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
        this._segs = null;
        this._domInit()
        this._domUpdate();
    }

    _populateAttributes() {
        $a.forEach(this.attributes, entry => this._attrBacking[entry.name] = entry.value);
        this._dataBacking.param = this.innerHTML;
    }

    setAttribute(name, val) {
        this.attr[name] = val;
    }

    set innerHTML(val) {
        this.innerHTML = val;
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
        this._segs = [];
        let str = this._shadow.innerHTML;
        let match = null;
        while ((match = str.match(/\${([$A-Z_][0-9A-Z_$.]*)}/i)) !== null) {
            if (match.index > 0) {
                let preMatch = str.substring(0, match.index);
                this._segs.push(vals => preMatch);
            }
            let varName = match[1];
            this._segs.push(vals => vals[varName] || "${" + varName + "}");
            str = str.substring(match.index + match[0].length);
        }
        if (!!str)
            this._segs.push(vals => str);
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
        this._shadow.innerHTML = this._segs.map(seg => seg(props)).join("");
    }

}

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