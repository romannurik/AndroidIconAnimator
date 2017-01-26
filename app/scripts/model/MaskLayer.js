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

import {Property, PathDataProperty} from './properties';
import {BaseLayer} from './BaseLayer';

/**
 * A mask layer (mask defined by a path) that clips/masks layers that follow it
 * within its layer group.
 */
@Property.register([
  new PathDataProperty('pathData', {animatable: true}),
])
export class MaskLayer extends BaseLayer {
  constructor(obj = {}, opts = {}) {
    super(obj, opts);
    this.pathData = obj.pathData || '';
  }

  computeBounds() {
    return Object.assign({}, (this.pathData && this.pathData.bounds) ? this.pathData.bounds : null);
  }

  get typeString() {
    return 'mask';
  }

  get typeIdPrefix() {
    return 'mask';
  }

  get typeIcon() {
    return 'mask_layer';
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      pathData: this.pathData.pathString
    });
  }
}

BaseLayer.LAYER_CLASSES_BY_TYPE['mask'] = MaskLayer;
