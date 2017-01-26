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

import {Property, NumberProperty} from './properties';
import {BaseLayer} from './BaseLayer';

/**
 * A group ('folder') containing other layers.
 */
@Property.register([
  new NumberProperty('rotation', {animatable: true}),
  new NumberProperty('scaleX', {animatable: true}),
  new NumberProperty('scaleY', {animatable: true}),
  new NumberProperty('pivotX', {animatable: true}),
  new NumberProperty('pivotY', {animatable: true}),
  new NumberProperty('translateX', {animatable: true}),
  new NumberProperty('translateY', {animatable: true}),
])
export class LayerGroup extends BaseLayer {
  constructor(obj = {}, opts = {}) {
    super(obj, opts);
    this.layers = (obj.layers || []).map(obj => BaseLayer.load(obj, opts));
    this.rotation = obj.rotation || 0;
    this.scaleX = ('scaleX' in obj) ? obj.scaleX : 1;
    this.scaleY = ('scaleY' in obj) ? obj.scaleY : 1;
    this.pivotX = obj.pivotX || 0;
    this.pivotY = obj.pivotY || 0;
    this.translateX = obj.translateX || 0;
    this.translateY = obj.translateY || 0;

    // meta
    this.expanded = ('expanded' in obj) ? obj.expanded : true;
  }

  computeBounds() {
    let bounds = null;
    this.layers.forEach(child => {
      let childBounds = child.computeBounds();
      if (!childBounds) {
        return;
      }

      if (!bounds) {
        bounds = Object.assign({}, childBounds);
      } else {
        bounds.l = Math.min(childBounds.l, bounds.l);
        bounds.t = Math.min(childBounds.t, bounds.t);
        bounds.r = Math.max(childBounds.r, bounds.r);
        bounds.b = Math.max(childBounds.b, bounds.b);
      }
    });
    return bounds;
  }

  get layers() {
    return this.layers_ || [];
  }

  set layers(layers) {
    this.layers_ = layers;
    this.layers_.forEach(layer => layer.parent = this);
  }

  get typeString() {
    return 'group';
  }

  get typeIdPrefix() {
    return 'group';
  }

  get typeIcon() {
    return 'layer_group';
  }

  findLayerById(id) {
    for (let i = 0; i < this.layers.length; i++) {
      let layer = this.layers[i];
      if (layer.id === id) {
        return layer;
      } else if (layer.findLayerById) {
        layer = layer.findLayerById(id);
        if (layer) {
          return layer;
        }
      }
    }

    return null;
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      rotation: this.rotation,
      scaleX: this.scaleX,
      scaleY: this.scaleY,
      pivotX: this.pivotX,
      pivotY: this.pivotY,
      translateX: this.translateX,
      translateY: this.translateY,
      layers: this.layers.map(layer => layer.toJSON()),
      expanded: this.expanded,
    });
  }
}

BaseLayer.LAYER_CLASSES_BY_TYPE['group'] = LayerGroup;
