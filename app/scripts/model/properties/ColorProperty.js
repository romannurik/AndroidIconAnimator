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

import {ColorUtil} from 'ColorUtil';
import {MathUtil} from 'MathUtil';

import {Property} from './Property';

export class ColorProperty extends Property {
  interpolateValue(start, end, f) {
    start = ColorUtil.parseAndroidColor(start);
    end = ColorUtil.parseAndroidColor(end);
    return ColorUtil.toAndroidString({
      r: MathUtil.constrain(Math.round(Property.simpleInterpolate(start.r, end.r, f)), 0, 255),
      g: MathUtil.constrain(Math.round(Property.simpleInterpolate(start.g, end.g, f)), 0, 255),
      b: MathUtil.constrain(Math.round(Property.simpleInterpolate(start.b, end.b, f)), 0, 255),
      a: MathUtil.constrain(Math.round(Property.simpleInterpolate(start.a, end.a, f)), 0, 255)
    });
  }

  trySetEditedValue(obj, propertyName, value) {
    if (!value) {
      obj[propertyName] = null;
      return;
    }

    let processedValue = ColorUtil.parseAndroidColor(value);
    if (!processedValue) {
      processedValue = ColorUtil.parseAndroidColor(ColorUtil.svgToAndroidColor(value));
    }

    obj[propertyName] = ColorUtil.toAndroidString(processedValue);
  }

  get animatorValueType() {
    return 'colorType';
  }
}
