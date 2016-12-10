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

const PRECISION = 0.02;

export class PathInterpolator {
  constructor(pathData) {
    this.points = [];
    let path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttributeNS(null, 'd', pathData);
    let pathLength = path.getTotalLength();
    let numPoints = Math.floor(pathLength / PRECISION) + 1;
    for (let i = 0; i < numPoints; ++i) {
      let distance = (i * pathLength) / (numPoints - 1);
      this.points.push(path.getPointAtLength(distance));
    }
  }

  interpolate(f) {
    if (f <= 0) {
      return 0;
    } 
    if (f >= 1) {
      return 1;
    }

    // Do a binary search for the correct x to interpolate between.
    let startIndex = 0;
    let endIndex = this.points.length - 1;
    while (endIndex - startIndex > 1) {
      let midIndex = Math.floor((startIndex + endIndex) / 2);
      if (f < this.points[midIndex].x) {
        endIndex = midIndex;
      } else {
        startIndex = midIndex;
      }
    }

    let xRange = this.points[endIndex].x - this.points[startIndex].x;
    if (xRange == 0) {
      return this.points[startIndex].y;
    }

    let fInRange = f - this.points[startIndex].x;
    let fraction = fInRange / xRange;
    let startY = this.points[startIndex].y;
    let endY = this.points[endIndex].y;

    return startY + (fraction * (endY - startY));
  }
}
