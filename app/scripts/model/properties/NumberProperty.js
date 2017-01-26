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

import {Property} from './Property';

export class NumberProperty extends Property {
  constructor(opts = {}) {
    super();
    this.opts = opts;
  }

  trySetEditedValue(obj, propertyName, value) {
    value = parseFloat(value);
    if (!isNaN(value)) {
      if ('min' in this.opts) {
        value = Math.max(this.opts.min, value);
      }
      if ('max' in this.opts) {
        value = Math.min(this.opts.max, value);
      }
      if (this.opts.integer) {
        value = Math.floor(value);
      }
      obj[propertyName] = value;
    }
  }

  displayValueForValue(value) {
    if (typeof value === 'number') {
      return (Number.isInteger(value)
            ? value.toString()
            : Number(value.toFixed(3)).toString())
          .replace(/-/g, '\u2212');
    }
    return value;
  }

  setter_(obj, propertyName, value) {
    if (typeof value === 'string') {
      value = Number(value);
    }

    if (typeof value === 'number') {
      if (!isNaN(value)) {
        if ('min' in this.opts) {
          value = Math.max(this.opts.min, value);
        }
        if ('max' in this.opts) {
          value = Math.min(this.opts.max, value);
        }
        if (this.opts.integer) {
          value = Math.floor(value);
        }
      }
    }

    let backingPropertyName = `${propertyName}_`;
    obj[backingPropertyName] = value;
  }

  interpolateValue(start, end, f) {
    return Property.simpleInterpolate(start, end, f);
  }

  get animatorValueType() {
    return 'floatType';
  }
}
