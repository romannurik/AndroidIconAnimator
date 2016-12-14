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

import {Artwork} from './model';
import {IdProperty} from './modelproperties';
import {ColorUtil} from './colorutil';
import {SvgPathData} from './svgpathdata';
import {ModelUtil} from './modelutil';


export const SvgLoader = {
  loadArtworkFromSvgString(svgString) {
    let parser = new DOMParser();
    let doc = parser.parseFromString(svgString, 'image/svg+xml');

    let usedIds = {};

    let defsChildMap = new Map();
    let extractDefsMap_ = (node) => {
      if (!node || !node.childNodes.length) {
        return;
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        let child = node.childNodes[i];
        if (child instanceof SVGDefsElement) {
          for (let j = 0; j < child.childNodes.length; j++) {
            let defsChild = child.childNodes[j];
            if (defsChild.nodeType != Node.TEXT_NODE
                && defsChild.nodeType != Node.COMMENT_NODE) {
              defsChildMap.set(defsChild.id, defsChild);
            }
          }
        } else {
          extractDefsMap_(child);
        }
      }
    };

    let nodeToLayerData_ = (node, context) => {
      if (!node) {
        return null;
      }

      if (node.nodeType == Node.TEXT_NODE
        || node.nodeType == Node.COMMENT_NODE
        || node instanceof SVGDefsElement) {
        return null;
      }

      if (node instanceof SVGUseElement) {
        // TODO(alockwood): apparently xlink:href is deprecated... figure out what to do about that
        let defChildId = node.getAttributeNS('http://www.w3.org/1999/xlink', 'href');
        // TODO(alockwood): can we assume the href is formatted like '#idNameGoesHere'?
        defChildId = defChildId.substring(1);
        let replacementNode = defsChildMap.get(defChildId);
        if (!replacementNode) {
          return null;
        }
        node = replacementNode.cloneNode(true);
        node.id = defChildId;
      }

      let makeFinalNodeId_ = typeIdPrefix => {
        let finalId = ModelUtil.getUniqueId({
          prefix: IdProperty.sanitize(node.id || typeIdPrefix),
          objectById: id => usedIds[id],
        });
        usedIds[finalId] = true;
        return finalId;
      };

      let layerData = {};

      let simpleAttr_ = (nodeAttr, contextAttr) => {
        if (node.attributes[nodeAttr]) {
          context[contextAttr] = node.attributes[nodeAttr].value;
        }
      };

      // set attributes
      simpleAttr_('stroke', 'strokeColor');
      simpleAttr_('stroke-width', 'strokeWidth');
      simpleAttr_('stroke-linecap', 'strokeLinecap');
      simpleAttr_('stroke-linejoin', 'strokeLinejoin');
      simpleAttr_('stroke-miterlimit', 'strokeMiterLimit');
      simpleAttr_('stroke-opacity', 'strokeAlpha');
      simpleAttr_('fill', 'fillColor');
      simpleAttr_('fill-opacity', 'fillAlpha');

      // add transforms

      if (node.transform) {
        let transforms = Array.from(node.transform.baseVal);
        transforms.reverse();
        context.transforms = context.transforms ? context.transforms.slice() : [];
        context.transforms.splice(0, 0, ...transforms);
      }

      // see if this is a path
      let path;
      if (node instanceof SVGPathElement) {
        path = node.attributes.d.value;

      } else if (node instanceof SVGRectElement) {
        let l = lengthPx_(node.x),
            t = lengthPx_(node.y),
            r = l + lengthPx_(node.width),
            b = t + lengthPx_(node.height);
        path = `M ${l},${t} ${r},${t} ${r},${b} ${l},${b} Z`;

      } else if (node instanceof SVGLineElement) {
        let x1 = lengthPx_(node.x1),
            y1 = lengthPx_(node.y1),
            x2 = lengthPx_(node.x2),
            y2 = lengthPx_(node.y2);
        path = `M ${x1},${y1} ${x2},${y2} Z`;

      } else if (node instanceof SVGPolygonElement || node instanceof SVGPolylineElement) {
        path = 'M ' + Array.from(node.points).map(pt => pt.x +',' + pt.y).join(' ');
        if (node instanceof SVGPolygonElement) {
          path += ' Z';
        }

      } else if (node instanceof SVGCircleElement) {
        let cx = lengthPx_(node.cx),
            cy = lengthPx_(node.cy),
            r = lengthPx_(node.r);
        path = `M ${cx},${cy-r} A ${r} ${r} 0 1 0 ${cx},${cy+r} A ${r} ${r} 0 1 0 ${cx},${cy-r} Z`;

      } else if (node instanceof SVGEllipseElement) {
        let cx = lengthPx_(node.cx),
            cy = lengthPx_(node.cy),
            rx = lengthPx_(node.rx),
            ry = lengthPx_(node.ry);
        path = `M ${cx},${cy-ry} A ${rx} ${ry} 0 1 0 ${cx},${cy+ry} ` +
               `A ${rx} ${ry} 0 1 0 ${cx},${cy-ry} Z`;
      }

      if (path) {
        // transform all points
        if (context.transforms && context.transforms.length) {
          let pathData = new SvgPathData(path);
          pathData.transform(context.transforms);
          path = pathData.pathString;
        }

        // create a path layer
        return Object.assign(layerData, {
          id: makeFinalNodeId_('path'),
          pathData: path,
          fillColor: ('fillColor' in context) ? ColorUtil.svgToAndroidColor(context.fillColor) : null,
          fillAlpha: ('fillAlpha' in context) ? context.fillAlpha : 1,
          strokeColor: ('strokeColor' in context) ? ColorUtil.svgToAndroidColor(context.strokeColor) : null,
          strokeAlpha: ('strokeAlpha' in context) ? context.strokeAlpha : 1,
          strokeWidth: context.strokeWidth || 0,
          strokeLinecap: context.strokeLinecap || 'butt',
          strokeLinejoin: context.strokeLinejoin || 'miter',
          strokeMiterLimit: context.strokeMiterLimit || 4,
        });
      }

      if (node.childNodes.length) {
        let layers = Array.from(node.childNodes)
            .map(child => nodeToLayerData_(child, Object.assign({}, context)))
            .filter(layer => !!layer);
        if (layers && layers.length) {
          // create a group (there are valid children)
          return Object.assign(layerData, {
            id: makeFinalNodeId_('group'),
            type: 'group',
            layers: layers
          });
        } else {
          return null;
        }
      }
    };

    let docElContext = {};
    let width = lengthPx_(doc.documentElement.width);
    let height = lengthPx_(doc.documentElement.height);

    if (doc.documentElement.viewBox) {
      width = doc.documentElement.viewBox.baseVal.width;
      height = doc.documentElement.viewBox.baseVal.height;

      // fake a translate transform for the viewbox
      docElContext.transforms = [
        {
          matrix: {
            a: 1,
            b: 0,
            c: 0,
            d: 1,
            e: -doc.documentElement.viewBox.baseVal.x,
            f: -doc.documentElement.viewBox.baseVal.y
          }
        }
      ];
    }

    extractDefsMap_(doc.documentElement);
    let rootLayer = nodeToLayerData_(doc.documentElement, docElContext);

    let artwork = {
      width,
      height,
      layers: (rootLayer ? rootLayer.layers : null) || [],
      alpha: doc.documentElement.getAttribute('opacity') || 1,
    };

    return new Artwork(artwork);
  }
};


function lengthPx_(svgLength) {
  if (svgLength.baseVal) {
    svgLength = svgLength.baseVal;
  }
  svgLength.convertToSpecifiedUnits(SVGLength.SVG_LENGTHTYPE_PX);
  return svgLength.valueInSpecifiedUnits;
}

