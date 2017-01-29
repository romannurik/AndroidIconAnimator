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
    let cosR = Math.cos(layer.rotation * Math.PI / 180);
    let sinR = Math.sin(layer.rotation * Math.PI / 180);

    // first negative pivot, then scale, rotate, translate, and pivot
    // notes:
    // translate: [1, 0, 0, 1, x, y]
    // scale: [sx, 0, 0, sy, 0, 0]
    // rotate: [cos, sin, -sin, cos, 0, 0]

    return [
      cosR * layer.scaleX,
      sinR * layer.scaleX,
      -sinR * layer.scaleY,
      cosR * layer.scaleY,
      (layer.pivotX + layer.translateX)
          - cosR * layer.scaleX * layer.pivotX
          + sinR * layer.scaleY * layer.pivotY,
      (layer.pivotY + layer.translateY)
          - cosR * layer.scaleY * layer.pivotY
          - sinR * layer.scaleX * layer.pivotX
    ];
  },

  flattenTransforms(transforms) {
    return (transforms || []).reduce(
        (m, transform) => transformMatrix_(transform, m),
        IDENTITY_TRANSFORM_MATRIX);
  },

  transformPoint(matrices, p) {
    if (!matrices || !matrices.length) {
      return Object.assign({}, p);
    }

    return matrices.reduce((p, m) => ({
      // [a c e]   [p.x]
      // [b d f] * [p.y]
      // [0 0 1]   [ 1 ]
      x: m[0] * p.x + m[2] * p.y + m[4],
      y: m[1] * p.x + m[3] * p.y + m[5]
    }), p);
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

    let vecA = RenderUtil.transformPoint([transformMatrix], {x:0, y:1});
    let vecB = RenderUtil.transformPoint([transformMatrix], {x:1, y:0});
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


// formula generated w/ wolfram alpha
// returns the product of 2D transformation matrices s and t

function transformMatrix_(s, t) {
  return [t[0] * s[0] + t[1] * s[2],
          t[0] * s[1] + t[1] * s[3],
          s[0] * t[2] + s[2] * t[3],
          s[1] * t[2] + t[3] * s[3],
          s[0] * t[4] + s[4] + s[2] * t[5],
          s[1] * t[4] + s[3] * t[5] + s[5]];
}
