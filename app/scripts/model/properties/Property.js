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

export class Property {
  interpolateValue(start, end, f) {
    return start;
  }

  getEditableValue(obj, propertyName) {
    return obj[propertyName];
  }

  trySetEditedValue(obj, propertyName, value) {
    obj[propertyName] = value;
  }

  getter_(obj, propertyName, value) {
    let backingPropertyName = `${propertyName}_`;
    return obj[backingPropertyName];
  }

  setter_(obj, propertyName, value) {
    let backingPropertyName = `${propertyName}_`;
    obj[backingPropertyName] = value;
  }

  displayValueForValue(val) {
    return val;
  }

  cloneValue(val) {
    return val;
  }

  static simpleInterpolate(start, end, f) {
    return start + (end - start) * f;
  }

  static register(props, {reset = false} = {}) {
    return function(cls) {
      props.forEach(prop => {
        let propertyObj = prop.property;
        if (propertyObj instanceof Property) {
          Object.defineProperty(cls.prototype, prop.name, {
            get() {
              return propertyObj.getter_(this, prop.name);
            },
            set(value) {
              propertyObj.setter_(this, prop.name, value);
            }
          });
        }
      });

      let animatableProperties = {};
      let inspectableProperties = {};

      if (!reset) {
        Object.assign(animatableProperties, cls.prototype.animatableProperties);
        Object.assign(inspectableProperties, cls.prototype.inspectableProperties);
      }

      props.forEach(p => {
        if (p.animatable) {
          animatableProperties[p.name] = p.property;
        }

        if (!p.inspectable) {
          inspectableProperties[p.name] = p.property;
        }
      });

      Object.defineProperty(cls.prototype, 'animatableProperties', {
        get: () => Object.assign({}, animatableProperties)
      });

      Object.defineProperty(cls.prototype, 'inspectableProperties', {
        get: () => Object.assign({}, inspectableProperties)
      });
    };
  }
}