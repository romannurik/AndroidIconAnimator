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

const IDENTITY_TRANSFORM_MATRIX = [1, 0, 0, 1, 0, 0];

export const RenderUtil = {
  transformMatrixForLayer(layer) {
    let m = IDENTITY_TRANSFORM_MATRIX.slice();
    // TODO: collapse into a single operation
    if (layer.pivotX || layer.pivotY) {
      m = translateMatrix_(m, layer.pivotX, layer.pivotY);
    }
    if (layer.translateX || layer.translateY) {
      m = translateMatrix_(m, layer.translateX, layer.translateY);
    }
    if (layer.rotation) {
      m = rotateMatrix_(m, layer.rotation * Math.PI / 180);
    }
    if (layer.scaleX !== 1 || layer.scaleY !== 1) {
      m = scaleMatrix_(m, layer.scaleX, layer.scaleY);
    }
    if (layer.pivotX || layer.pivotY) {
      m = translateMatrix_(m, -layer.pivotX, -layer.pivotY);
    }
    return m;
  },

  flattenTransforms(transforms) {
    return (transforms || []).reduce(
        (m, transform) => transformMatrix_(transform, m),
        IDENTITY_TRANSFORM_MATRIX);
  },

  computeStrokeWidthMultiplier(transformMatrix) {
    // from getMatrixScale in
    // https://android.googlesource.com/platform/frameworks/base/+/master/libs/hwui/VectorDrawable.cpp

    // Given unit vectors A = (0, 1) and B = (1, 0).
    // After matrix mapping, we got A' and B'. Let theta = the angel b/t A' and B'.
    // Therefore, the final scale we want is min(|A'| * sin(theta), |B'| * sin(theta)),
    // which is (|A'| * |B'| * sin(theta)) / max (|A'|, |B'|);
    // If  max (|A'|, |B'|) = 0, that means either x or y has a scale of 0.
    //
    // For non-skew case, which is most of the cases, matrix scale is computing exactly the
    // scale on x and y axis, and take the minimal of these two.
    // For skew case, an unit square will mapped to a parallelogram. And this function will
    // return the minimal height of the 2 bases.

    // first remove translate elements from matrix
    transformMatrix[4] = transformMatrix[5] = 0;

    let vecA = transformPoint_(transformMatrix, {x:0, y:1});
    let vecB = transformPoint_(transformMatrix, {x:1, y:0});
    let scaleX = Math.hypot(vecA.x, vecA.y);
    let scaleY = Math.hypot(vecB.x, vecB.y);
    let crossProduct = vecA.y * vecB.x - vecA.x * vecB.y; // vector cross product
    let maxScale = Math.max(scaleX, scaleY);
    let matrixScale = 0;
    if (maxScale > 0) {
      matrixScale = Math.abs(crossProduct) / maxScale;
    }
    return matrixScale;
  }
};



// TODO: merge with implementation in SvgPathData
function transformPoint_(m, p) {
  // [a c e]   [p.x]
  // [b d f] * [p.y]
  // [0 0 1]   [ 1 ]
  return {
    x: m[0] * p.x + m[2] * p.y + m[4],
    y: m[1] * p.x + m[3] * p.y + m[5]
  };
}


// formula generated w/ wolfram alpha
// returns the dot product of 2D transformation matrices s and t

function transformMatrix_(s, t) {
  return [s[0] * t[0] + s[1] * t[2],
          s[0] * t[1] + s[1] * t[3],
          t[0] * s[2] + t[2] * s[3],
          t[1] * s[2] + s[3] * t[3],
          t[0] * s[4] + t[4] + t[2] * s[5],
          t[1] * s[4] + t[3] * s[5] + t[5]];
}

// https://developer.mozilla.org/en-US/docs/Web/SVG/Attribute/transform

function translateMatrix_(m, x, y) {
  return transformMatrix_([1, 0, 0, 1, x, y], m);
}

function scaleMatrix_(m, sx, sy) {
  return transformMatrix_([sx, 0, 0, sy, 0, 0], m);
}

function rotateMatrix_(m, angle) {
  return transformMatrix_(
      [Math.cos(angle), Math.sin(angle), -Math.sin(angle), Math.cos(angle), 0, 0], m);
}
