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

import {default as bezierEasing} from 'bezier-easing';

import {SvgPathData} from '../SvgPathData';
import {Property, StubProperty, NumberProperty, EnumProperty} from './properties';

const FAST_OUT_SLOW_IN_EASING = bezierEasing(.4, 0, .2, 1);
const FAST_OUT_LINEAR_IN_EASING = bezierEasing(.4, 0, 1, 1);
const LINEAR_OUT_SLOW_IN_EASING = bezierEasing(0, 0, .2, 1);

const ENUM_INTERPOLATOR_OPTIONS = [
  {
    value: 'ACCELERATE_DECELERATE',
    label: 'Accelerate/decelerate',
    androidRef: '@android:anim/accelerate_decelerate_interpolator',
    interpolate: f => Math.cos((f + 1) * Math.PI) / 2.0 + 0.5,
  },
  {
    value: 'ACCELERATE',
    label: 'Accelerate',
    androidRef: '@android:anim/accelerate_interpolator',
    interpolate: f => f * f,
  },
  {
    value: 'DECELERATE',
    label: 'Decelerate',
    androidRef: '@android:anim/decelerate_interpolator',
    interpolate: f => (1 - (1 - f) * (1 - f)),
  },
  {
    value: 'ANTICIPATE',
    label: 'Anticipate',
    androidRef: '@android:anim/anticipate_interpolator',
    interpolate: f => f * f * ((2 + 1) * f - 2),
  },
  {
    value: 'LINEAR',
    label: 'Linear',
    androidRef: '@android:anim/linear_interpolator',
    interpolate: f => f,
  },
  {
    value: 'OVERSHOOT',
    label: 'Overshoot',
    androidRef: '@android:anim/overshoot_interpolator',
    interpolate: f => (f - 1) * (f - 1) * ((2 + 1) * (f - 1) + 2) + 1
  },
  {
    value: 'FAST_OUT_SLOW_IN',
    label: 'Fast out, slow in',
    androidRef: '@android:interpolator/fast_out_slow_in',
    interpolate: f => FAST_OUT_SLOW_IN_EASING(f)
  },
  {
    value: 'FAST_OUT_LINEAR_IN',
    label: 'Fast out, linear in',
    androidRef: '@android:interpolator/fast_out_linear_in',
    interpolate: f => FAST_OUT_LINEAR_IN_EASING(f)
  },
  {
    value: 'LINEAR_OUT_SLOW_IN',
    label: 'Linear out, slow in',
    interpolate: f => LINEAR_OUT_SLOW_IN_EASING(f)
  },
  //BOUNCE: https://android.googlesource.com/platform/frameworks/base/+/refs/heads/master/core/java/android/view/animation/BounceInterpolator.java
  //ANTICIPATE_OVERSHOOT: https://android.googlesource.com/platform/frameworks/base/+/refs/heads/master/core/java/android/view/animation/AnticipateOvershootInterpolator.java
  //PATH: https://android.googlesource.com/platform/frameworks/base/+/refs/heads/master/core/java/android/view/animation/PathInterpolator.java
];

/**
 * An animation block is an individual layer property tween (property animation).
 */
@Property.register([
  new StubProperty('fromValue'),
  new StubProperty('toValue'),
  new NumberProperty('startTime', {min:0, integer:true}),
  new NumberProperty('endTime', {min:0, integer:true}),
  new EnumProperty('interpolator', ENUM_INTERPOLATOR_OPTIONS, {storeEntireOption:true}),
])
export class AnimationBlock {
  constructor(obj = {}) {
    this.layerId = obj.layerId || null;
    this.propertyName = obj.propertyName || null;
    let isPathData = (this.propertyName == 'pathData');
    if ('fromValue' in obj) {
      this.fromValue = isPathData ? new SvgPathData(obj.fromValue) : obj.fromValue;
    }
    this.toValue = isPathData ? new SvgPathData(obj.toValue) : obj.toValue;
    this.startTime = obj.startTime || 0;
    this.endTime = obj.endTime || 0;
    if (this.startTime > this.endTime) {
      let tmp = this.endTime;
      this.endTime = this.startTime;
      this.startTime = tmp;
    }
    this.interpolator = obj.interpolator || 'ACCELERATE_DECELERATE';
  }

  get typeString() {
    return 'block';
  }

  get typeIdPrefix() {
    return 'block';
  }

  get typeIcon() {
    return 'animation_block';
  }

  toJSON() {
    return {
      layerId: this.layerId,
      propertyName: this.propertyName,
      fromValue: valueToJson_(this.fromValue),
      toValue: valueToJson_(this.toValue),
      startTime: this.startTime,
      endTime: this.endTime,
      interpolator: this.interpolator.value,
    };
  }
}

function valueToJson_(val) {
  if (typeof val == 'object' && 'toJSON' in val) {
    return val.toJSON();
  }

  return val;
}
