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

export const ModelUtil = {
  getOrderedAnimationBlocksByLayerIdAndProperty(animation) {
    let animationBlocksByLayerId = {};

    animation.blocks.forEach(block => {
      let blocksByProperty = animationBlocksByLayerId[block.layerId];
      if (!blocksByProperty) {
        blocksByProperty = {};
        animationBlocksByLayerId[block.layerId] = blocksByProperty;
      }

      blocksByProperty[block.propertyName] = blocksByProperty[block.propertyName] || [];
      blocksByProperty[block.propertyName].push(block);
    });

    for (let layerId in animationBlocksByLayerId) {
      let blocksByProperty = animationBlocksByLayerId[layerId];
      for (let propertyName in blocksByProperty) {
        blocksByProperty[propertyName].sort((a, b) => a.startTime - b.startTime);
      }
    }

    return animationBlocksByLayerId;
  },

  getUniqueId(opts) {
    opts = opts || {};
    opts.prefix = opts.prefix || '';
    opts.objectById = opts.objectById || (() => null);
    opts.targetObject = opts.targetObject || null;

    let n = 0;
    let id_ = () => opts.prefix + (n ? `_${n}` : '');
    while (true) {
      let o = opts.objectById(id_());
      if (!o || o == opts.targetObject) {
        break;
      }

      ++n;
    }

    return id_();
  }
};
