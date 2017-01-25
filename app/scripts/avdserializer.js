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

import {Artwork, PathLayer, LayerGroup, MaskLayer, DefaultValues} from './model';
import xmlserializer from 'xmlserializer';

const XMLNS_NS = 'http://www.w3.org/2000/xmlns/';
const ANDROID_NS = 'http://schemas.android.com/apk/res/android';
const AAPT_NS = 'http://schemas.android.com/aapt';


let conditionalAttr_ = (node, attr, value, skipValue) => {
  if (value !== undefined
      && value !== null
      && (skipValue === undefined || value !== skipValue)) {
    node.setAttributeNS(ANDROID_NS, attr, value);
  }
};


let serializeXmlNode_ = xmlNode => {
  let xmlStr = xmlserializer.serializeToString(xmlNode, {indent:4, multiAttributeIndent:4});
  return xmlStr; //new XMLSerializer().serializeToString(xmlNode);
  // return vkbeautify.xml(xmlStr, 4);
};


export const AvdSerializer = {

  /**
   * Serializes an Artwork to a vector drawable XML file.
   */
  artworkToVectorDrawableXmlString(artwork) {
    let xmlDoc = document.implementation.createDocument(null, 'vector');
    let rootNode = xmlDoc.documentElement;
    AvdSerializer.artworkToXmlNode_(artwork, rootNode, xmlDoc);
    return serializeXmlNode_(rootNode);
  },

  /**
   * Serializes a given Artwork and Animation to an animatedvector drawable XML file.
   */
  artworkAnimationToAvdXmlString(artwork, animation) {
    let xmlDoc = document.implementation.createDocument(null, 'animated-vector');
    let rootNode = xmlDoc.documentElement;
    rootNode.setAttributeNS(XMLNS_NS, 'xmlns:android', ANDROID_NS);
    rootNode.setAttributeNS(XMLNS_NS, 'xmlns:aapt', AAPT_NS);

    // create drawable node containing the artwork
    let artworkContainerNode = xmlDoc.createElementNS(AAPT_NS, 'aapt:attr');
    artworkContainerNode.setAttribute('name', 'android:drawable');
    rootNode.appendChild(artworkContainerNode);

    let artworkNode = xmlDoc.createElement('vector');
    AvdSerializer.artworkToXmlNode_(artwork, artworkNode, xmlDoc);
    artworkContainerNode.appendChild(artworkNode);

    // create animation nodes (one per layer)
    let animBlocksByLayer = {};
    animation.blocks.forEach(block => {
      animBlocksByLayer[block.layerId] = animBlocksByLayer[block.layerId] || [];
      animBlocksByLayer[block.layerId].push(block);
    });

    for (let layerId in animBlocksByLayer) {
      let targetNode = xmlDoc.createElement('target');
      targetNode.setAttributeNS(ANDROID_NS, 'android:name', layerId);
      rootNode.appendChild(targetNode);

      let animationNode = xmlDoc.createElementNS(AAPT_NS, 'aapt:attr');
      animationNode.setAttribute('name', 'android:animation');
      targetNode.appendChild(animationNode);

      let blocksForLayer = animBlocksByLayer[layerId];
      let blockContainerNode = animationNode;
      let multiBlock = false;
      if (blocksForLayer.length > 1) {
        multiBlock = true;

        // <set> for multiple property animations on a single layer
        blockContainerNode = xmlDoc.createElement('set');
        blockContainerNode.setAttributeNS(XMLNS_NS, 'xmlns:android', ANDROID_NS);
        animationNode.appendChild(blockContainerNode);
      }

      let layer = artwork.findLayerById(layerId);
      let animatableProperties = layer.animatableProperties;

      blocksForLayer.forEach(block => {
        let blockNode = xmlDoc.createElement('objectAnimator');
        if (!multiBlock) {
          blockNode.setAttributeNS(XMLNS_NS, 'xmlns:android', ANDROID_NS);
        }
        blockNode.setAttributeNS(ANDROID_NS, 'android:name', layerId);
        blockNode.setAttributeNS(ANDROID_NS, 'android:propertyName', block.propertyName);
        conditionalAttr_(blockNode, 'android:startOffset', block.startTime, 0);
        conditionalAttr_(blockNode, 'android:duration', block.endTime - block.startTime);
        conditionalAttr_(blockNode, 'android:valueFrom', block.fromValue);
        conditionalAttr_(blockNode, 'android:valueTo', block.toValue);
        conditionalAttr_(blockNode, 'android:valueType',
            animatableProperties[block.propertyName].animatorValueType);
        conditionalAttr_(blockNode, 'android:interpolator', block.interpolator.androidRef);
        blockContainerNode.appendChild(blockNode);
      });
    }

    return serializeXmlNode_(rootNode);
  },

  /**
   * Helper method that serializes an Artwork to a destinationNode in an xmlDoc.
   * The destinationNode should be a <vector> node.
   */
  artworkToXmlNode_(artwork, destinationNode, xmlDoc) {
    destinationNode.setAttributeNS(XMLNS_NS, 'xmlns:android', ANDROID_NS);
    destinationNode.setAttributeNS(ANDROID_NS, 'android:width', `${artwork.width}dp`);
    destinationNode.setAttributeNS(ANDROID_NS, 'android:height', `${artwork.height}dp`);
    destinationNode.setAttributeNS(ANDROID_NS, 'android:viewportWidth', `${artwork.width}`);
    destinationNode.setAttributeNS(ANDROID_NS, 'android:viewportHeight', `${artwork.height}`);
    destinationNode.setAttributeNS(ANDROID_NS, 'android:alpha', `${artwork.alpha}`);

    artwork.walk((layer, parentNode) => {
      if (layer instanceof Artwork) {
        return parentNode;

      } else if (layer instanceof PathLayer) {
        let node = xmlDoc.createElement('path');
        conditionalAttr_(node, 'android:name', layer.id);
        conditionalAttr_(node, 'android:pathData', layer.pathData.pathString);
        conditionalAttr_(node, 'android:fillColor', layer.fillColor, '');
        conditionalAttr_(node, 'android:fillAlpha', layer.fillAlpha, 1);
        conditionalAttr_(node, 'android:strokeColor', layer.strokeColor, '');
        conditionalAttr_(node, 'android:strokeAlpha', layer.strokeAlpha, 1);
        conditionalAttr_(node, 'android:strokeWidth', layer.strokeWidth, 0);
        conditionalAttr_(node, 'android:trimPathStart', layer.trimPathStart, 0);
        conditionalAttr_(node, 'android:trimPathEnd', layer.trimPathEnd, 1);
        conditionalAttr_(node, 'android:trimPathOffset', layer.trimPathOffset, 0);
        conditionalAttr_(node, 'android:strokeLineCap', layer.strokeLinecap, DefaultValues.LINECAP);
        conditionalAttr_(node, 'android:strokeLineJoin', layer.strokeLinejoin,
            DefaultValues.LINEJOIN);
        conditionalAttr_(node, 'android:strokeMiterLimit', layer.strokeMiterLimit,
            DefaultValues.MITER_LIMIT);
        parentNode.appendChild(node);
        return parentNode;

      } else if (layer instanceof MaskLayer) {
        let node = xmlDoc.createElement('clip-path');
        conditionalAttr_(node, 'android:name', layer.id);
        conditionalAttr_(node, 'android:pathData', layer.pathData.pathString);
        parentNode.appendChild(node);
        return parentNode;

      } else if (layer instanceof LayerGroup) {
        let node = xmlDoc.createElement('group');
        conditionalAttr_(node, 'android:name', layer.id);
        conditionalAttr_(node, 'android:pivotX', layer.pivotX, 0);
        conditionalAttr_(node, 'android:pivotY', layer.pivotY, 0);
        conditionalAttr_(node, 'android:translateX', layer.translateX, 0);
        conditionalAttr_(node, 'android:translateY', layer.translateY, 0);
        conditionalAttr_(node, 'android:scaleX', layer.scaleX, 1);
        conditionalAttr_(node, 'android:scaleY', layer.scaleY, 1);
        conditionalAttr_(node, 'android:rotation', layer.rotation, 0);
        parentNode.appendChild(node);
        return node;
      }
    }, destinationNode);
  },
};
