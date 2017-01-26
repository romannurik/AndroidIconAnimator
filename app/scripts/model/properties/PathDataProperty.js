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

import {SvgPathData} from 'SvgPathData';

import {Property} from './Property';

export class PathDataProperty extends Property {
  interpolateValue(start, end, f) {
    return SvgPathData.interpolate(start, end, f);
  }

  displayValueForValue(val) {
    return val.pathString;
  }

  getEditableValue(obj, propertyName) {
    return obj[propertyName] ? obj[propertyName].pathString : '';
  }

  trySetEditedValue(obj, propertyName, stringValue) {
    obj[propertyName] = new SvgPathData(stringValue);
  }

  getter_(obj, propertyName) {
    let backingPropertyName = `${propertyName}_`;
    return obj[backingPropertyName];
  }

  setter_(obj, propertyName, value) {
    let backingPropertyName = `${propertyName}_`;
    let pathData;
    if (!value || value instanceof SvgPathData) {
      pathData = value;
    } else {
      pathData = new SvgPathData(value);
    }

    obj[backingPropertyName] = pathData;
  }

  cloneValue(val) {
    return JSON.parse(JSON.stringify(val));
  }

  get animatorValueType() {
    return 'pathType';
  }
}
