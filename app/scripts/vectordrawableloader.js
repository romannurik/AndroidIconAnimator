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

import {Artwork, DefaultValues} from './model';
import {IdProperty} from './modelproperties';
import {ModelUtil} from './modelutil';


export const VectorDrawableLoader = {
  loadArtworkFromXmlString(xmlString) {
    let parser = new DOMParser();
    let doc = parser.parseFromString(xmlString, 'application/xml');

    let usedIds = {};

    let nodeToLayerData_ = (node) => {
      if (!node) {
        return null;
      }
      if (node.nodeType == Node.TEXT_NODE || node.nodeType == Node.COMMENT_NODE) {
        return null;
      }

      let makeFinalNodeId_ = (node, typeIdPrefix) => {
        let name = node.getAttribute('android:name');
        let finalId = ModelUtil.getUniqueId({
            prefix: IdProperty.sanitize(name || typeIdPrefix),
            objectById: id => usedIds[id],
        });
        usedIds[finalId] = true;
        return finalId;
      };

      let layerData = {};

      if (node.tagName === 'path') {
        return Object.assign(layerData, {
            id: makeFinalNodeId_(node, 'path'),
            pathData: node.getAttribute('android:pathData') || null,
            fillColor: node.getAttribute('android:fillColor') || null,
            fillAlpha: node.getAttribute('android:fillAlpha') || 1,
            strokeColor: node.getAttribute('android:strokeColor') || null,
            strokeAlpha: node.getAttribute('android:strokeAlpha') || 1,
            strokeWidth: node.getAttribute('android:strokeWidth') || 0,
            strokeLinecap: node.getAttribute('android:strokeLineCap') || DefaultValues.LINECAP,
            strokeLinejoin: node.getAttribute('android:strokeLineJoin') || DefaultValues.LINEJOIN,
            strokeMiterLimit:
                node.getAttribute('android:strokeMiterLimit') || DefaultValues.MITER_LIMIT,
            trimPathStart: node.getAttribute('android:trimPathStart') || 0,
            trimPathEnd: node.getAttribute('android:trimPathEnd') || 1,
            trimPathOffset: node.getAttribute('android:trimPathOffset') || 0,
        });
      }

      if (node.childNodes.length) {
        let layers = Array.from(node.childNodes)
            .map(child => nodeToLayerData_(child))
            .filter(layer => !!layer);
        if (layers && layers.length) {
          // create a group (there are valid children)
          return Object.assign(layerData, {
              id: makeFinalNodeId_(node, 'group'),
              type: 'group',
              rotation: node.getAttribute('android:rotation') || 0,
              scaleX: node.getAttribute('android:scaleX') || 1,
              scaleY: node.getAttribute('android:scaleY') || 1,
              pivotX: node.getAttribute('android:pivotX') || 0,
              pivotY: node.getAttribute('android:pivotY') || 0,
              translateX: node.getAttribute('android:translateX') || 0,
              translateY: node.getAttribute('android:translateY') || 0,
              layers,
          });
        } else {
          return null;
        }
      }
    };

    let rootLayer = nodeToLayerData_(doc.documentElement);
    let id = IdProperty.sanitize(doc.documentElement.getAttribute('android:name') || 'vector');
    usedIds[id] = true;
    let width = doc.documentElement.getAttribute('android:viewportWidth');
    let height = doc.documentElement.getAttribute('android:viewportHeight');
    let alpha = doc.documentElement.getAttribute('android:alpha') || 1;
    let artwork = {
        id,
        width,
        height,
        layers: (rootLayer ? rootLayer.layers : null) || [],
        alpha,
    };
    return new Artwork(artwork);
  }
};
