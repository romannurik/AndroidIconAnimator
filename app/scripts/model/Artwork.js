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

import {Property, IdProperty, ColorProperty, NumberProperty, FractionProperty} from './properties';
import {BaseLayer} from './BaseLayer';
import {LayerGroup} from './LayerGroup';

/**
 * An artwork is the root layer group for a vector, defined mostly by
 * a width, height, and its children.
 */
@Property.register([
  new IdProperty('id'),
  new ColorProperty('canvasColor'),
  new NumberProperty('width', {min:4, max:1024, integer:true}),
  new NumberProperty('height', {min:4, max:1024, integer:true}),
  new FractionProperty('alpha', {animatable: true}),
], {reset:true})
export class Artwork extends LayerGroup {
  constructor(obj = {}, opts = {}) {
    super(obj, opts);
    this.id = this.id || this.typeIdPrefix;
    this.canvasColor = obj.fillColor || null;
    this.width = obj.width || 100;
    this.height = obj.height || 100;
    this.alpha = obj.alpha || 1;
  }

  computeBounds() {
    return { l: 0, t: 0, r: this.width, b: this.height };
  }

  get typeString() {
    return 'artwork';
  }

  get typeIdPrefix() {
    return 'vector';
  }

  get typeIcon() {
    return 'artwork';
  }

  findLayerById(id) {
    if (this.id === id) {
      return this;
    }
    return super.findLayerById(id);
  }

  toJSON() {
    return {
      id: this.id,
      canvasColor: this.canvasColor,
      width: this.width,
      height: this.height,
      alpha: this.alpha,
      layers: this.layers.map(layer => layer.toJSON())
    };
  }
}

BaseLayer.LAYER_CLASSES_BY_TYPE['artwork'] = Artwork;
