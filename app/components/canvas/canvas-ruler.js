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

const EXTRA_PADDING = 12;
const GRID_INTERVALS_PX = [1, 2, 4, 8, 16, 24, 48, 100, 100, 250];
const LABEL_OFFSET = 12;
const TICK_SIZE = 6;


angular.module('AVDStudio').directive('canvasRuler', function() {
  return {
    restrict: 'E',
    scope: {},
    template: '<canvas></canvas>',
    replace: true,
    require: '^studioCanvas',
    link: function(scope, element, attrs, studioCanvasCtrl) {
      let $canvas = element;
      let canvas = $canvas.get(0);
      let isHorizontal = (attrs.orientation == 'horizontal');
      let artworkWidth, artworkHeight;
      let mouseX, mouseY;

      $canvas
          .addClass('canvas-ruler')
          .addClass('orientation-' + attrs.orientation);

      // most scope methods called by canvas

      scope.hideMouse = () => {
        mouseX = -1;
        mouseY = -1;
        scope.redraw();
      };

      scope.showMousePosition = (x, y) => {
        mouseX = x;
        mouseY = y;
        scope.redraw();
      };

      scope.setArtworkSize = size => {
        artworkWidth = size.width;
        artworkHeight = size.height;
        scope.redraw();
      };

      scope.redraw = () => {
        let width = $canvas.width();
        let height = $canvas.height();
        $canvas.attr('width', width * window.devicePixelRatio);
        $canvas.attr('height', height * window.devicePixelRatio);

        let ctx = canvas.getContext('2d');
        ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
        ctx.translate(
            isHorizontal ? EXTRA_PADDING : 0,
            isHorizontal ? 0 : EXTRA_PADDING);

        let zoom = Math.max(1, isHorizontal
            ? (width - EXTRA_PADDING * 2) / artworkWidth
            : (height - EXTRA_PADDING * 2) / artworkHeight);

        // compute grid spacing (40 = minimum grid spacing in pixels)
        let interval = 0;
        let spacingArtPx = GRID_INTERVALS_PX[interval];
        while ((spacingArtPx * zoom) < 40 || interval >= GRID_INTERVALS_PX.length) {
          ++interval;
          spacingArtPx = GRID_INTERVALS_PX[interval];
        }

        let spacingRulerPx = spacingArtPx * zoom;

        // text labels
        ctx.fillStyle = 'rgba(255,255,255,.3)';
        ctx.font = '10px Roboto';
        if (isHorizontal) {
          ctx.textBaseline = 'alphabetic';
          ctx.textAlign = 'center';
          for (let x = 0, t = 0;
               x <= (width - EXTRA_PADDING * 2);
               x += spacingRulerPx, t += spacingArtPx) {
            ctx.fillText(t, x, height - LABEL_OFFSET);
            ctx.fillRect(x - 0.5, height - TICK_SIZE, 1, TICK_SIZE);
          }
        } else {
          ctx.textBaseline = 'middle';
          ctx.textAlign = 'right';
          for (let y = 0, t = 0;
               y <= (height - EXTRA_PADDING * 2);
               y += spacingRulerPx, t += spacingArtPx) {
            ctx.fillText(t, width - LABEL_OFFSET, y);
            ctx.fillRect(width - TICK_SIZE, y - 0.5, TICK_SIZE, 1);
          }
        }

        ctx.fillStyle = 'rgba(255,255,255,.7)';
        if (isHorizontal && mouseX >= 0) {
          ctx.fillText(mouseX, mouseX * zoom, height - LABEL_OFFSET);
        } else if (!isHorizontal && mouseY >= 0) {
          ctx.fillText(mouseY, width - LABEL_OFFSET, mouseY * zoom);
        }
      }

      studioCanvasCtrl.registerRuler(scope);
      scope.$on('$destroy', () => studioCanvasCtrl.unregisterRuler(scope));
    }
  };
});
