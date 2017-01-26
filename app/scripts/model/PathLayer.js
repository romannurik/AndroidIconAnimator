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

import {Property, PathDataProperty, NumberProperty, ColorProperty,
        FractionProperty, EnumProperty} from './properties';
import {BaseLayer} from './BaseLayer';

export const DefaultValues = {
  LINECAP: 'butt',
  LINEJOIN: 'miter',
  MITER_LIMIT: 4,
};

const ENUM_LINECAP_OPTIONS = [
  {value: 'butt', label: 'Butt'},
  {value: 'square', label: 'Square'},
  {value: 'round', label: 'Round'},
];

const ENUM_LINEJOIN_OPTIONS = [
  {value: 'miter', label: 'Miter'},
  {value: 'round', label: 'Round'},
  {value: 'bevel', label: 'Bevel'},
];

/**
 * A path layer, which is the main building block for visible content in a vector
 * artwork.
 */
export class PathLayer extends BaseLayer {
  constructor(obj = {}, opts = {}) {
    super(obj, opts);
    this.pathData = obj.pathData || '';
    this.fillColor = obj.fillColor || null;
    this.fillAlpha = ('fillAlpha' in obj) ? obj.fillAlpha : 1;
    this.strokeColor = obj.strokeColor || '';
    this.strokeAlpha = ('strokeAlpha' in obj) ? obj.strokeAlpha : 1;
    this.strokeWidth = obj.strokeWidth || 0;
    this.strokeLinecap = obj.strokeLinecap || DefaultValues.LINECAP;
    this.strokeLinejoin = obj.strokeLinejoin || DefaultValues.LINEJOIN;
    this.strokeMiterLimit = obj.strokeMiterLimit || DefaultValues.MITER_LIMIT;
    this.trimPathStart = obj.trimPathStart || 0;
    this.trimPathEnd = ('trimPathEnd' in obj && typeof obj.trimPathEnd == 'number')
        ? obj.trimPathEnd : 1;
    this.trimPathOffset = obj.trimPathOffset || 0;
  }

  computeBounds() {
    return Object.assign({}, (this.pathData && this.pathData.bounds) ? this.pathData.bounds : null);
  }

  get typeString() {
    return 'path';
  }

  get typeIdPrefix() {
    return 'path';
  }

  get typeIcon() {
    return 'path_layer';
  }

  toJSON() {
    return Object.assign(super.toJSON(), {
      pathData: this.pathData.pathString,
      fillColor: this.fillColor,
      fillAlpha: this.fillAlpha,
      strokeColor: this.strokeColor,
      strokeAlpha: this.strokeAlpha,
      strokeWidth: this.strokeWidth,
      strokeLinecap: this.strokeLinecap,
      strokeLinejoin: this.strokeLinejoin,
      strokeMiterLimit: this.strokeMiterLimit,
      trimPathStart: this.trimPathStart,
      trimPathEnd: this.trimPathEnd,
      trimPathOffset: this.trimPathOffset
    });
  }
}

Property.registerProperties(PathLayer, [
  {name: 'pathData', property: new PathDataProperty(), animatable: true},
  {name: 'fillColor', property: new ColorProperty(), animatable: true},
  {name: 'fillAlpha', property: new FractionProperty(), animatable: true},
  {name: 'strokeColor', property: new ColorProperty(), animatable: true},
  {name: 'strokeAlpha', property: new FractionProperty(), animatable: true},
  {name: 'strokeWidth', property: new NumberProperty({min:0}), animatable: true},
  {name: 'strokeLinecap', property: new EnumProperty(ENUM_LINECAP_OPTIONS)},
  {name: 'strokeLinejoin', property: new EnumProperty(ENUM_LINEJOIN_OPTIONS)},
  {name: 'strokeMiterLimit', property: new NumberProperty({min:1})},
  {name: 'trimPathStart', property: new FractionProperty(), animatable: true},
  {name: 'trimPathEnd', property: new FractionProperty(), animatable: true},
  {name: 'trimPathOffset', property: new FractionProperty(), animatable: true}
]);

BaseLayer.LAYER_CLASSES_BY_TYPE['path'] = PathLayer;
