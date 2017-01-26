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

import assert from 'assert';
import {ColorUtil} from '../app/scripts/ColorUtil';

describe('ColorUtil', () => {
  let TESTS_ANDROID_RAW = [
    ['#f000', {r:0,g:0,b:0,a:255}, '#000000'],
    ['f00', {r:255,g:0,b:0,a:255}, '#ff0000'],
    ['#7f00ff00', {r:0,g:255,b:0,a:127}, '#7f00ff00'],
    ['an invalid color', null],
  ];

  let TESTS_ANDROID_CSS = [
    ['#f000', 'rgba(0,0,0,1.00)', '#000000'],
    ['f00', 'rgba(255,0,0,1.00)', '#ff0000'],
    ['#7f00ff00', 'rgba(0,255,0,0.50)', '#8000ff00'],
    ['', 'transparent', '#00000000'],
  ];

  describe('#parseAndroidColor', () => {
    TESTS_ANDROID_RAW.forEach(a => {
      it(`parsing '${a[0]}' yields ${JSON.stringify(a[1])}`, () =>
          assert.deepEqual(a[1], ColorUtil.parseAndroidColor(a[0])));
    });
  });

  describe('#toAndroidString', () => {
    TESTS_ANDROID_RAW.forEach(a => {
      if (a[1]) {
        it(`converting ${JSON.stringify(a[1])} to string yields '${a[2]}'`, () => {
          assert.deepEqual(a[2], ColorUtil.toAndroidString(a[1]));
        });
      }
    });
  });

  describe('#androidToCssColor', () => {
    TESTS_ANDROID_CSS.forEach(a => {
      it(`converting '${a[0]}' to CSS color yields '${a[1]}'`, () =>
          assert.equal(a[1], ColorUtil.androidToCssColor(a[0])));
    });
  });

  describe('#svgToAndroidColor', () => {
    TESTS_ANDROID_CSS.forEach(a => {
      it(`converting '${a[1]}' to Android color yields '${a[2]}'`, () =>
          assert.equal(a[2], ColorUtil.svgToAndroidColor(a[1])));
    });
  });
});
