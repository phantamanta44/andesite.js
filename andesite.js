"use strict";
class _Selector {

    constructor(selector) {
        this.selector = selector;
        this.elems = [];
        this._updateElems();
    }

    _updateElems() {
        this.elems = document.querySelectorAll(this.selector);
    }

    forEach(cb) {
        this.elems.forEach(cb);
    }

    get first() {
        return this.elems[0];
    }

}

function $(selector) {
    return new Proxy(new _Selector(selector), {
        get: (target, name) => name in target ? target[name] : target.first[name],
        set: (target, name, val) => {
            if (name in target) {
                target[name] = val;
                if (name === "selector")
                    target._updateElems();
            } else {
                target.first[name] = val;
            }
            return true;
        }
    });
}

class _StandardComponent extends HTMLElement {

    constructor() {
        super();
        this._attrBacking = {};
        this.attr = new Proxy(this._attrBacking, {
            get: (target, name) => {
                if (name in target) {
                    return target[name];
                } else {
                    target[name] = this.getAttribute(name);
                    return target[name];
                }
            },
            set: (target, name, val) => {
                target[name] = val;
                super.setAttribute(name, val);
                this._domUpdate();
                return true;
            }
        });
        this._shadow = null;
        this._segs = null;
        if (this._domInit())
            this._domUpdate();
    }

    setAttribute(name, val) {
        this.attr[name] = val;
    }

    set id(val) {
        this.attr.id = val;
    }

    get id() {
        return this.attr.id;
    }

    attributeChangedCallback(name, oldVal, newVal) {
        this._attrBacking[name] = newVal;
    }

    _domInit() {
        this._shadow = this.attachShadow({mode: "open"});
        this._shadow.innerHTML = $a._importRegistry[this.tagName.toLowerCase()];
        this._segs = [];
        let str = this._shadow.innerHTML;
        let match = null;
        while ((match = str.match(/\${([$A-Z_][0-9A-Z_$]*)}/i)) !== null) {
            if (match.index > 0) {
                let preMatch = str.substring(0, match.index);
                this._segs.push(vals => preMatch);
            }
            let varName = match[1];
            this._segs.push(vals => vals[varName]);
            str = str.substring(match.index + match[0].length);
        }
        if (!!str)
            this._segs.push(vals => str);
        if (!!this.innerHTML) {
            this.attr.param = this.innerHTML;
            this.innerHTML = "";
            return false;
        }
        return true;
    }

    _domUpdate() {
        this._shadow.innerHTML = this._segs.map(seg => seg(this.attr)).join("");
    }

}

class _AndesiteInstance {

    constructor() {
        this._readyHandlers = [];
        this._componentRegistry = [];
        this._importRegistry = {};
    }

    component(componentName) {
        $a.forEach(arguments, name => {
            let id = "a-" + name;
            $a.ajax("static/component/" + name + ".html", doc => {
                this._importRegistry[id] = doc;
                customElements.define(id, _StandardComponent);
                this._componentRegistry.push(id);
            });
        });
    }

    ready(cb) {
        this._readyHandlers.push(cb);
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
    document.addEventListener("DOMContentLoaded", () => $a.ready());