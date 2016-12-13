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

import {default as tinycolor} from 'tinycolor2';

const BRIGHTNESS_THRESHOLD = 130; // for isColorDark


export const ColorUtil = {
  parseAndroidColor(val) {
    val = (val || '').replace(/^\s*#?|\s*$/g, '');
    let dict = {a:255};

    if (val.length == 3) {
      dict.r = parseInt(val.substring(0, 1), 16) * 17;
      dict.g = parseInt(val.substring(1, 2), 16) * 17;
      dict.b = parseInt(val.substring(2, 3), 16) * 17;
    } else if (val.length == 4) {
      dict.a = parseInt(val.substring(0, 1), 16) * 17;
      dict.r = parseInt(val.substring(1, 2), 16) * 17;
      dict.g = parseInt(val.substring(2, 3), 16) * 17;
      dict.b = parseInt(val.substring(3, 4), 16) * 17;
    } else if (val.length == 6) {
      dict.r = parseInt(val.substring(0, 2), 16);
      dict.g = parseInt(val.substring(2, 4), 16);
      dict.b = parseInt(val.substring(4, 6), 16);
    } else if (val.length == 8) {
      dict.a = parseInt(val.substring(0, 2), 16);
      dict.r = parseInt(val.substring(2, 4), 16);
      dict.g = parseInt(val.substring(4, 6), 16);
      dict.b = parseInt(val.substring(6, 8), 16);
    } else {
      return null;
    }

    return (isNaN(dict.r) || isNaN(dict.g) || isNaN(dict.b) || isNaN(dict.a))
        ? null
        : dict;
  },

  toAndroidString(dict) {
    let str = '#';
    if (dict.a != 255) {
      str += ((dict.a < 16) ? '0' : '') + dict.a.toString(16);
    }

    str += ((dict.r < 16) ? '0' : '') + dict.r.toString(16)
        + ((dict.g < 16) ? '0' : '') + dict.g.toString(16)
        + ((dict.b < 16) ? '0' : '') + dict.b.toString(16);
    return str;
  },

  svgToAndroidColor(color) {
    if (color == 'none') {
      return null;
    }
    color = tinycolor(color);
    let colorHex = color.toHex();
    let alphaHex = color.toHex8().substr(6);
    return '#' + alphaHex + colorHex;
  },

  androidToCssColor(androidColor, multAlpha) {
    multAlpha = (multAlpha === undefined) ? 1 : multAlpha;
    if (!androidColor) {
      return 'transparent';
    }

    let d = ColorUtil.parseAndroidColor(androidColor);
    return `rgba(${d.r},${d.g},${d.b},${(d.a * multAlpha / 255).toFixed(2)})`;
  },

  isAndroidColorDark(androidColor) {
    if (!androidColor) {
      return false;
    }

    let d = ColorUtil.parseAndroidColor(androidColor);
    return ((30 * d.r + 59 * d.g + 11 * d.b) / 100) <= BRIGHTNESS_THRESHOLD;
  }
};
