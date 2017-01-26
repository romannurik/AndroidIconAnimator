/*
 * Copyright 2016 Google Inc.
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

import {Property, IdProperty} from './properties';

/**
 * Base class for any node in the tree, including path layers, layer groups, and artworks.
 */
@Property.register([
  new IdProperty('id')
])
export class BaseLayer {
  constructor(obj = {}, opts = {}) {
    this.parent = null;
    this.id = obj.id || null;
    if (opts && opts.linkSelectedState) {
      this.selectedStateLinkedObj_ = obj;
    }

    // meta
    this.visible = ('visible' in obj) ? obj.visible : true;
    this.expanded = true;
  }

  get selected() {
    return this.selectedStateLinkedObj_
        ? this.selectedStateLinkedObj_.selected_
        : this.selected_;
  }

  computeBounds() {
    return null;
  }

  getSibling_(offs) {
    if (!this.parent || !this.parent.layers) {
      return null;
    }

    let index = this.parent.layers.indexOf(this);
    if (index < 0) {
      return null;
    }

    index += offs;
    if (index < 0 || index >= this.parent.layers.length) {
      return null;
    }

    return this.parent.layers[index];
  }

  get previousSibling() {
    return this.getSibling_(-1);
  }

  get nextSibling() {
    return this.getSibling_(1);
  }

  remove() {
    if (!this.parent || !this.parent.layers) {
      return;
    }

    let index = this.parent.layers.indexOf(this);
    if (index >= 0) {
      this.parent.layers.splice(index, 1);
    }

    this.parent = null;
  }

  walk(fn, context) {
    let visit_ = (layer, context) => {
      let childContext = fn(layer, context);
      if (layer.layers) {
        walkLayerGroup_(layer, childContext);
      }
    };

    let walkLayerGroup_ = (layerGroup, context) => {
      layerGroup.layers.forEach(layer => visit_(layer, context));
    };

    visit_(this, context);
  }

  toJSON() {
    return {
      id: this.id,
      type: this.typeString,
      visible: this.visible,
    };
  }

  static load(obj = {}, opts) {
    if (obj instanceof BaseLayer) {
      return new obj.constructor(obj, opts);
    }

    return new BaseLayer.LAYER_CLASSES_BY_TYPE[obj.type || 'path'](obj, opts);
  }
}

// filled in by derived classes
BaseLayer.LAYER_CLASSES_BY_TYPE = {};
