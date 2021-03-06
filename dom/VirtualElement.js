import deleteFromArray from '../util/deleteFromArray'
import flattenOften from '../util/flattenOften'
import isArray from '../util/isArray'
import isFunction from '../util/isFunction'
import isNumber from '../util/isNumber'
import isBoolean from '../util/isBoolean'
import isNil from '../util/isNil'
import isPlainObject from '../util/isPlainObject'
import isString from '../util/isString'
import _isDefined from '../util/_isDefined'
import hasOwnProperty from '../util/hasOwnProperty'
import without from '../util/without'
import map from '../util/map'
import DOMElement from './DOMElement'

/**
  A virtual {@link DOMElement} which is used by the {@link Component} API.

  A VirtualElement is just a description of a DOM structure. It represents a
  virtual DOM mixed with Components. This virtual structure needs to be compiled
  to a {@link Component} to actually create a real DOM element,
  which is done by {@link RenderingEngine}
*/
export default class VirtualElement extends DOMElement {
  constructor (owner) {
    super()

    // set when this gets inserted into another virtual element
    this.parent = null
    // set when created by RenderingContext
    this._owner = owner
    // set when ref'd
    this._ref = null
  }

  getParent () {
    return this.parent
  }

  get childNodes () {
    return this.getChildNodes()
  }

  getChildCount () {
    return this.children.length
  }

  getChildAt (idx) {
    return this.children[idx]
  }

  /*
    Provides the component after this VirtualElement has been rendered.
  */
  getComponent () {
    return this._comp
  }

  /**
    Associates a reference identifier with this element.

    When rendered the corresponding component is stored in the owner using the given key.
    In addition to that, components with a reference are preserved when its parent is rerendered.

    > Attention: only the owner should use this method, as it only
      affects the owner's references

    @param {String} ref id for the compiled Component
  */
  ref (ref) {
    if (!ref) throw new Error('Illegal argument')
    // Attention: only the owner should create a ref()
    // unfortunately, with the current implementation this can not be ensured
    if (this._ref) throw new Error('A VirtualElement can only be referenced once.')
    this._ref = ref
    if (this._context) {
      const refs = this._context.refs
      if (refs.has(ref)) {
        throw new Error('An item with reference "' + ref + '" already exists.')
      }
      refs.set(ref, this)
    }
    return this
  }

  isInDocument () {
    return false
  }

  get _isVirtualElement () { return true }
}

/*
  A virtual HTML element.
*/
class VirtualHTMLElement extends VirtualElement {
  constructor (tagName) {
    super()

    this._tagName = tagName
    this.classNames = null
    this.attributes = null
    this.htmlProps = null
    this.style = null
    this.eventListeners = null

    // TODO: this is semantically incorrect. It should be named childNodes
    this.children = []
  }

  getTagName () {
    return this._tagName
  }

  setTagName (tagName) {
    this._tagName = tagName
    return this
  }

  hasClass (className) {
    if (this.classNames) {
      return this.classNames.indexOf(className) > -1
    }
    return false
  }

  addClass (className) {
    if (!this.classNames) {
      this.classNames = []
    }
    this.classNames.push(className)
    return this
  }

  removeClass (className) {
    if (this.classNames) {
      this.classNames = without(this.classNames, className)
    }
    return this
  }

  removeAttribute (name) {
    if (this.attributes) {
      this.attributes.delete(name)
    }
    return this
  }

  getAttribute (name) {
    if (this.attributes) {
      return this.attributes.get(name)
    }
  }

  setAttribute (name, value) {
    if (!this.attributes) {
      this.attributes = new Map()
    }
    this.attributes.set(name, String(value))
    return this
  }

  getAttributes () {
    // we are having separated storages for different
    // kind of attributes which we now pull together
    // in the same way as a native DOM element has it
    // TODO: is this really a good idea?
    // maybe we should also treat the others as attributes
    let entries = []
    if (this.attributes) {
      entries = Array.from(this.attributes)
    }
    if (this.classNames) {
      entries.push(['class', this.classNames.join(' ')])
    }
    if (this.style) {
      entries.push(['style', map(this.style, function (val, key) {
        return key + ':' + val
      }).join(';')])
    }
    return new Map(entries)
  }

  getId () {
    return this.getAttribute('id')
  }

  setId (id) {
    this.setAttribute('id', id)
    return this
  }

  setTextContent (text) {
    text = String(text || '')
    this.empty()
    this.appendChild(text)
    return this
  }

  setInnerHTML (html) {
    html = html || ''
    this.empty()
    this._innerHTMLString = html
    return this
  }

  getInnerHTML () {
    if (!_isDefined(this._innerHTMLString)) {
      throw new Error('Not supported.')
    } else {
      return this._innerHTMLString
    }
  }

  getValue () {
    return this.htmlProp('value')
  }

  setValue (value) {
    this.htmlProp('value', value)
    return this
  }

  getChildNodes () {
    return this.children
  }

  getChildren () {
    return this.children.filter(function (child) {
      return child.getNodeType() !== 'text'
    })
  }

  isTextNode () {
    return false
  }

  isElementNode () {
    return true
  }

  isCommentNode () {
    return false
  }

  isDocumentNode () {
    return false
  }

  append () {
    if (this._innerHTMLString) {
      throw Error('It is not possible to mix $$.html() with $$.append(). You can call $$.empty() to reset this virtual element.')
    }
    this._append(this.children, arguments)
    return this
  }

  appendChild (child) {
    if (this._innerHTMLString) {
      throw Error('It is not possible to mix $$.html() with $$.append(). You can call $$.empty() to reset this virtual element.')
    }
    this._appendChild(this.children, child)
    return this
  }

  insertAt (pos, child) {
    child = this._normalizeChild(child)
    if (!child) {
      throw new Error('Illegal child: ' + child)
    }
    if (!child._isVirtualElement) {
      throw new Error('Illegal argument for $$.insertAt():' + child)
    }
    if (pos < 0 || pos > this.children.length) {
      throw new Error('insertAt(): index out of bounds.')
    }
    this._insertAt(this.children, pos, child)
    return this
  }

  insertBefore (child, before) {
    var pos = this.children.indexOf(before)
    if (pos > -1) {
      this.insertAt(pos, child)
    } else {
      throw new Error('insertBefore(): reference node is not a child of this element.')
    }
    return this
  }

  removeAt (pos) {
    if (pos < 0 || pos >= this.children.length) {
      throw new Error('removeAt(): Index out of bounds.')
    }
    this._removeAt(pos)
    return this
  }

  removeChild (child) {
    if (!child || !child._isVirtualElement) {
      throw new Error('removeChild(): Illegal arguments. Expecting a CheerioDOMElement instance.')
    }
    var idx = this.children.indexOf(child)
    if (idx < 0) {
      throw new Error('removeChild(): element is not a child.')
    }
    this.removeAt(idx)
    return this
  }

  replaceChild (oldChild, newChild) {
    if (!newChild || !oldChild ||
        !newChild._isVirtualElement || !oldChild._isVirtualElement) {
      throw new Error('replaceChild(): Illegal arguments. Expecting BrowserDOMElement instances.')
    }
    var idx = this.children.indexOf(oldChild)
    if (idx < 0) {
      throw new Error('replaceChild(): element is not a child.')
    }
    this.removeAt(idx)
    this.insertAt(idx, newChild)
    return this
  }

  empty () {
    var children = this.children
    while (children.length) {
      var child = children.pop()
      child.parent = null
    }
    delete this._innerHTMLString
    return this
  }

  getProperty (name) {
    if (this.htmlProps) {
      return this.htmlProps.get(name)
    }
  }

  setProperty (name, value) {
    if (!this.htmlProps) {
      this.htmlProps = new Map()
    }
    this.htmlProps.set(name, value)
    return this
  }

  removeProperty (name) {
    if (this.htmlProps) {
      this.htmlProps.delete(name)
    }
    return this
  }

  getStyle (name) {
    if (this.style) {
      return this.style.get(name)
    }
  }

  setStyle (name, value) {
    if (!this.style) {
      this.style = new Map()
    }
    if (DOMElement.pxStyles[name] && isNumber(value)) value = value + 'px'
    this.style.set(name, value)
    return this
  }

  _createEventListener (eventName, handler, options) {
    options.context = options.context || this._owner._comp
    return super._createEventListener(eventName, handler, options)
  }

  getNodeType () {
    return 'element'
  }

  hasInnerHTML () {
    return Boolean(this._innerHTMLString)
  }

  _normalizeChild (child) {
    if (isNil(child)) {

    } else if (child._isVirtualElement) {
      return child
    } else if (isString(child) || isBoolean(child) || isNumber(child)) {
      return new VirtualTextNode(String(child))
    } else {
      console.error('Unsupported child type', child)
      throw new Error('Unsupported child type')
    }
  }

  _append (outlet, args) {
    if (args.length === 1 && !isArray(args[0])) {
      this._appendChild(outlet, args[0])
      return
    }
    var children
    if (isArray(args[0])) {
      children = args[0]
    } else if (arguments.length > 1) {
      children = Array.prototype.slice.call(args, 0)
    } else {
      return
    }
    children.forEach(this._appendChild.bind(this, outlet))
  }

  _appendChild (outlet, child) {
    child = this._normalizeChild(child)
    // TODO: discuss. Having a bad feeling about this,
    // because it could obscure an implementation error
    if (!child) return
    outlet.push(child)
    this._attach(child)
    return child
  }

  _insertAt (outlet, pos, child) {
    if (!child) return
    outlet.splice(pos, 0, child)
    this._attach(child)
  }

  _removeAt (outlet, pos) {
    var child = outlet[pos]
    outlet.splice(pos, 1)
    this._detach(child)
  }

  _attach (child) {
    child.parent = this
    if (this._context) {
      if (child._owner !== this._owner && child._isVirtualComponent) {
        this._context.injectedComponents.push(child)
      }
      if (child._owner !== this._owner && child._ref) {
        this._context.foreignRefs[child._ref] = child
      }
    }
  }

  _detach (child) {
    child.parent = null
    if (this._context) {
      if (child._isVirtualComponent) {
        deleteFromArray(this._context.injectedComponents, child)
      }
      if (child._owner !== this._owner && child._ref) {
        this._context.foreignRefs.delete(child._ref)
      }
    }
  }

  _copy () {
    if (this.classNames || this.attributes || this.eventListeners || this.htmlProps || this.style) {
      const copy = {}
      if (this.classNames) {
        copy.classNames = this.classNames.slice()
      }
      if (this.attributes) {
        copy.attributes = new Map(this.attributes)
      }
      if (this.eventListeners) {
        copy.eventListeners = this.eventListeners.slice()
      }
      if (this.htmlProps) {
        copy.htmlProps = new Map(this.htmlProps)
      }
      if (this.style) {
        copy.style = new Map(this.style)
      }
      return copy
    }
  }

  _clear () {
    this.classNames = null
    this.attributes = null
    this.htmlProps = null
    this.style = null
    this.eventListeners = null
  }

  _merge (other) {
    if (!other) return
    const ARRAY_TYPE_VALS = ['classNames', 'eventListeners']
    for (const name of ARRAY_TYPE_VALS) {
      const otherVal = other[name]
      if (otherVal) {
        const thisVal = this[name]
        if (!thisVal) {
          this[name] = otherVal.slice()
        } else {
          this[name] = thisVal.concat(otherVal)
        }
      }
    }
    const MAP_TYPE_VALS = ['attributes', 'htmlProps', 'style']
    for (const name of MAP_TYPE_VALS) {
      const otherVal = other[name]
      if (otherVal) {
        const thisVal = this[name]
        if (!thisVal) {
          this[name] = new Map(otherVal)
        } else {
          this[name] = new Map([...thisVal, ...otherVal])
        }
      }
    }
  }

  get _isVirtualHTMLElement () { return true }
}

/*
  A virtual element which gets rendered by a custom component.
*/
class VirtualComponent extends VirtualHTMLElement {
  constructor (ComponentClass, props) {
    super()

    props = props || {}

    this.ComponentClass = ComponentClass
    this.props = props
    if (!props.children) {
      props.children = []
    }
    this.children = props.children
  }

  getComponent () {
    return this._comp
  }

  // Note: for VirtualComponentElement we put children into props
  // so that the render method of ComponentClass can place it.
  getChildren () {
    return this.props.children
  }

  getNodeType () {
    return 'component'
  }

  // TODO: this seems to be not so useful
  // as this is also possible by just using props
  outlet (name) {
    return new Outlet(this, name)
  }

  setInnerHTML () {
    throw new Error('Can not set innerHTML of a Component')
  }

  _attach (child) {
    child._preliminaryParent = this
  }

  _detach (child) {
    child._preliminaryParent = null
  }

  get _isVirtualHTMLElement () { return false }

  get _isVirtualComponent () { return true }
}

class Outlet {
  constructor (virtualEl, name) {
    this.virtualEl = virtualEl
    this.name = name
    Object.freeze(this)
  }

  _getOutlet () {
    var outlet = this.virtualEl.props[this.name]
    if (!outlet) {
      outlet = []
      this.virtualEl.props[this.name] = outlet
    }
    return outlet
  }

  append () {
    var outlet = this._getOutlet()
    this.virtualEl._append(outlet, arguments)
    return this
  }

  empty () {
    var arr = this.virtualEl.props[this.name]
    arr.forEach(function (el) {
      this._detach(el)
    }.bind(this))
    arr.splice(0, arr.length)
    return this
  }
}

class VirtualTextNode extends VirtualElement {
  constructor (text) {
    super()
    this.text = text
  }

  get _isVirtualTextNode () { return true }
}

VirtualElement.Component = VirtualComponent
VirtualElement.TextNode = VirtualTextNode

/**
  Create a virtual DOM representation which is used by Component
  for differential/reactive rendering.

  @param elementType HTML tag name or Component class
  @param [props] a properties object for Component classes
  @return {VirtualElement} a virtual DOM node

  @example

  Create a virtual DOM Element

  ```
  $$('a').attr({href: './foo'}).addClass('se-nav-item')
  ```

  Create a virtual Component

  ```
  $$(HelloMessage, {name: 'John'})
  ```
*/
VirtualElement.createElement = function () {
  var content
  var _first = arguments[0]
  var _second = arguments[1]
  var type
  if (isString(_first)) {
    type = 'element'
  } else if (isFunction(_first)) {
    type = 'component'
  } else if (isNil(_first)) {
    throw new Error('$$(null): provided argument was null or undefined.')
  } else {
    throw new Error('Illegal usage of $$()')
  }
  // some props are mapped to built-ins
  var props = {}
  var classNames, ref
  var eventHandlers = []
  for (var key in _second) {
    if (!hasOwnProperty(_second, key)) continue
    var val = _second[key]
    switch (key) {
      case 'class':
        classNames = val
        break
      case 'ref':
        ref = val
        break
      default:
        props[key] = val
    }
  }
  if (type === 'element') {
    content = new VirtualHTMLElement(_first)
    // remaining props are attributes
    // TODO: should we make sure that these are only string values?
    content.attr(props)
  } else {
    content = new VirtualComponent(_first, props)
  }
  // HACK: this is set to the current context by RenderingEngine
  // otherwise this will provide rubbish
  content._owner = this.owner
  if (classNames) {
    content.addClass(classNames)
  }
  if (ref) {
    content.ref(ref)
  }
  eventHandlers.forEach(function (h) {
    if (isFunction(h.handler)) {
      content.on(h.name, h.handler)
    } else if (isPlainObject(h.handler)) {
      var params = h.handler
      content.on(h.name, params.handler, params.context, params)
    } else {
      throw new Error('Illegal arguments for $$(_,{ on' + h.name + '})')
    }
  })
  // allow a notation similar to React.createElement
  // $$(MyComponent, {}, ...children)
  if (arguments.length > 2) {
    content.append(flattenOften(Array.prototype.slice.call(arguments, 2), 3))
  }
  return content
}

VirtualElement.Context = class VirtualElementContext {
  constructor (owner) {
    this.owner = owner
    // used to track refs created via `el.ref()`
    this.refs = new Map()
    // used to keep refs that are set by a different owner, when a component is
    // passed via props
    this.foreignRefs = new Map()
    // all VirtualElements created such as `$$('div')`
    this.elements = []
    // all VirtualComponents created such as `$$(Foo)`
    this.components = []
    // all VirtualComponents that are appended but not owned, i.e. injected from parent
    this.injectedComponents = []
    this.$$ = this._createElement.bind(this)
    this.$$.capturing = true
  }

  _createElement () {
    const vel = VirtualElement.createElement.apply(this, arguments)
    vel._context = this
    vel._owner = this.owner
    if (vel._isVirtualComponent) {
      // virtual components need to be captured recursively
      this.components.push(vel)
    }
    this.elements.push(vel)
    return vel
  }
}
