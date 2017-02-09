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

import {LayerGroup, MaskLayer, PathLayer, DefaultValues} from 'model';
import {ColorUtil} from 'ColorUtil';
import {RenderUtil} from 'RenderUtil';
import {ElementResizeWatcher} from 'ElementResizeWatcher';


const CANVAS_MARGIN = 72; // pixels


class CanvasController {
  constructor($scope, $element, $attrs, StudioStateService, $timeout) {
    this.scope_ = $scope;
    this.element_ = $element;
    this.attrs_ = $attrs;
    this.canvas_ = $element.find('canvas');
    this.offscreenCanvas_ = $(document.createElement('canvas'));
    this.studioState_ = StudioStateService;
    this.registeredRulers_ = [];

    this.isPreviewMode = 'previewMode' in $attrs;
    if (this.isPreviewMode) {
      this.element_.addClass('preview-mode');
    }

    this.setupMouseEventHandlers_();

    let changeHandler_ = (event, changes) => {
      if (changes.playing) {
        if (this.studioState_.playing) {
          this.animStart = Number(new Date())
              - this.studioState_.activeTime / this.studioState_.playbackSpeed;
        }

        this.drawCanvas_();
      }

      if (changes.activeTime) {
        this.animTime = this.studioState_.activeTime;
        this.drawCanvas_();
      }

      if (changes.selection) {
        this.drawCanvas_();
      }

      if (changes.artwork || changes.animations || changes.activeAnimation) {
        this.resizeAndDrawCanvas_();
      }
    };

    changeHandler_(null, {playing: true, activeTime: true, artwork: true});

    this.studioState_.onChange(changeHandler_, $scope);

    if (!this.isPreviewMode) {
      let resizeWatcher = new ElementResizeWatcher(
          this.element_, () => this.resizeAndDrawCanvas_());
      $scope.$on('$destroy', () => resizeWatcher.destroy());
    }

    $timeout(() => this.resizeAndDrawCanvas_(), 0);
  }

  hitTest_(point, rootLayer = null) {
    rootLayer = rootLayer || this.artwork;

    const matrices = [];

    // TODO(alockwood): select clips and/or groups in addition to paths?
    const hitTestLayer_ = layer => {
      if (layer instanceof LayerGroup) {
        matrices.unshift(RenderUtil.transformMatrixForLayer(layer));
        // hitTestLayer || h and not the other way around because of reverse z-order
        const result = layer.layers.reduce((h, layer) => hitTestLayer_(layer) || h, null);
        matrices.shift();
        return result;

      } else if (layer instanceof PathLayer && layer.pathData) {
        const pointTransformerFn = p => RenderUtil.transformPoint(matrices, p);
        if ((layer.fillColor &&
             layer.pathData.hitTestFill(point, pointTransformerFn)) ||
            (layer.strokeColor &&
             layer.pathData.hitTestStroke(point, pointTransformerFn, layer.strokeWidth))) {
          return layer;
        }

        return null;
      }

      return null;
    };

    return hitTestLayer_(rootLayer);
  }

  setupMouseEventHandlers_() {
    this.canvas_
        .on('mousedown', event => {
          const canvasOffset = this.canvas_.offset();
          const x = (event.pageX - canvasOffset.left) / this.scale_;
          const y = (event.pageY - canvasOffset.top) / this.scale_;

          let currentArtwork;
          if (this.studioState_.animationRenderer) {
            this.studioState_.animationRenderer.setAnimationTime(this.animTime || 0);
            currentArtwork = this.studioState_.animationRenderer.renderedArtwork;
          } else {
            currentArtwork = this.artwork;
          }

          let targetLayer = this.hitTest_({x, y}, currentArtwork);
          this.scope_.$apply(() => {
            if (targetLayer) {
              targetLayer = this.artwork.findLayerById(targetLayer.id);
              if (event.metaKey || event.shiftKey) {
                this.studioState_.toggleSelected(targetLayer);
              } else {
                this.studioState_.selection = [targetLayer];
              }
            } else if (!event.metaKey && !event.shiftKey) {
              this.studioState_.selection = [];
            }
          });
        })
        .on('mousemove', event => {
          let canvasOffset = this.canvas_.offset();
          let x = Math.round((event.pageX - canvasOffset.left) / this.scale_);
          let y = Math.round((event.pageY - canvasOffset.top) / this.scale_);
          this.registeredRulers_.forEach(r => r.showMousePosition(x, y));
        })
        .on('mouseleave', () => {
          this.registeredRulers_.forEach(r => r.hideMouse());
        });
  }

  get artwork() {
    return this.studioState_.artwork;
  }

  get animation() {
    return this.studioState_.activeAnimation;
  }

  registerRuler(rulerScope) {
    this.registeredRulers_.push(rulerScope);
    this.redrawRulers_();
  }

  unregisterRuler(rulerScope) {
    let idx = this.registeredRulers_.indexOf(rulerScope);
    if (idx >= 0) {
      this.registeredRulers_.splice(idx, 1);
    }
  }

  redrawRulers_() {
    this.registeredRulers_.forEach(r => {
      r.setArtworkSize({
        width: this.artwork.width,
        height: this.artwork.height
      });
      r.redraw();
    });
  }

  resizeAndDrawCanvas_() {
    if (this.isPreviewMode) {
      this.scale_ = 1;
    } else {
      let containerWidth = Math.max(1, this.element_.width() - CANVAS_MARGIN * 2);
      let containerHeight = Math.max(1, this.element_.height() - CANVAS_MARGIN * 2);
      let containerAspectRatio = containerWidth / containerHeight;
      let artworkAspectRatio = this.artwork.width / (this.artwork.height || 1);

      if (artworkAspectRatio > containerAspectRatio) {
        this.scale_ = containerWidth / this.artwork.width;
      } else {
        this.scale_ = containerHeight / this.artwork.height;
      }
    }

    this.scale_ = this.scale_ > 1
        ? Math.floor(this.scale_)
        : Math.max(.1, this.scale_);
    this.backingStoreScale_ = this.scale_ * (window.devicePixelRatio || 1);
    [this.canvas_, this.offscreenCanvas_].forEach(canvas => {
      canvas
          .attr({
            width: this.artwork.width * this.backingStoreScale_,
            height: this.artwork.height * this.backingStoreScale_,
          })
          .css({
            width: this.artwork.width * this.scale_,
            height: this.artwork.height * this.scale_,
          });
    });

    this.drawCanvas_();
    this.redrawRulers_();
  }

  drawCanvas_() {
    if (this.animationFrameRequest_) {
      window.cancelAnimationFrame(this.animationFrameRequest_);
      this.animationFrameRequest_ = null;
    }

    if (!this.artwork) {
      return;
    }

    let ctx = this.canvas_.get(0).getContext('2d');
    ctx.save();
    ctx.scale(this.backingStoreScale_, this.backingStoreScale_);
    ctx.clearRect(0, 0, this.artwork.width, this.artwork.height);
    if (this.artwork.canvasColor) {
      ctx.fillStyle = ColorUtil.androidToCssColor(this.artwork.canvasColor);
      ctx.fillRect(0, 0, this.artwork.width, this.artwork.height);
    }

    let selectionStroke_ = extraSetupFn => {
      ctx.save();
      // ctx.globalCompositeOperation = 'exclusion';
      extraSetupFn && extraSetupFn();
      ctx.lineWidth = 6 / this.scale_; // 2px
      ctx.strokeStyle = '#fff';
      ctx.lineCap = 'round';
      ctx.stroke();
      ctx.strokeStyle = '#2196f3';
      ctx.lineWidth = 3 / this.scale_; // 2px
      ctx.stroke();
      ctx.restore();
    };

    let transforms = [];

    let drawLayer_ = (ctx, layer, selectionMode) => {
      if (layer instanceof LayerGroup) {
        if (!selectionMode && !layer.visible) {
          return;
        }

        transforms.unshift(RenderUtil.transformMatrixForLayer(layer));

        ctx.save();
        layer.layers.forEach(layer => drawLayer_(ctx, layer, selectionMode));
        ctx.restore();

        if (selectionMode && layer.selected) {
          let bounds = layer.computeBounds();
          if (bounds) {
            ctx.save();
            ctx.transform(...RenderUtil.flattenTransforms(transforms));
            ctx.beginPath();
            ctx.rect(bounds.l, bounds.t, bounds.r - bounds.l, bounds.b - bounds.t);
            ctx.restore();
            selectionStroke_();
          }
        }

        transforms.shift();
      } else if (layer instanceof MaskLayer) {
        ctx.save();
        ctx.transform(...RenderUtil.flattenTransforms(transforms));
        layer.pathData && layer.pathData.execute(ctx);
        ctx.restore();

        if (!selectionMode) {
          // clip further layers
          ctx.clip();
        } else if (selectionMode && layer.selected) {
          // this layer is selected, draw the layer selection stuff
          selectionStroke_(() => ctx.setLineDash([5 / this.scale_, 5 / this.scale_]));
        }

      } else {
        if (!selectionMode && !layer.visible) {
          return;
        }

        let flattenedTransforms = RenderUtil.flattenTransforms(transforms);

        ctx.save();
        ctx.transform(...flattenedTransforms);
        if (selectionMode) {
          layer.pathData && layer.pathData.execute(ctx);
        } else {
          layer.pathData && layer.pathData.executeTrimmed(
              ctx, layer.trimPathStart, layer.trimPathEnd, layer.trimPathOffset);
        }
        ctx.restore();

        if (!selectionMode) {
          let strokeWidthMultiplier = RenderUtil.computeStrokeWidthMultiplier(flattenedTransforms);

          // draw the actual layer
          ctx.strokeStyle = ColorUtil.androidToCssColor(layer.strokeColor, layer.strokeAlpha);
          ctx.lineWidth = layer.strokeWidth * strokeWidthMultiplier;
          ctx.fillStyle = ColorUtil.androidToCssColor(layer.fillColor, layer.fillAlpha);
          ctx.lineCap = layer.strokeLinecap || DefaultValues.LINECAP;
          ctx.lineJoin = layer.strokeLinejoin || DefaultValues.LINEJOIN;
          ctx.miterLimit = layer.miterLimit || DefaultValues.MITER_LIMIT;

          if (layer.strokeColor
              && layer.strokeWidth
              && layer.trimPathStart != layer.trimPathEnd) {
            ctx.stroke();
          }
          if (layer.fillColor) {
            ctx.fill();
          }
        } else if (selectionMode && layer.selected) {
          // this layer is selected, draw the layer selection stuff
          selectionStroke_();
        }
      }
    };

    // draw artwork
    let offscreenCtx = this.offscreenCanvas_.get(0).getContext('2d');
    let currentArtwork;
    if (this.studioState_.animationRenderer) {
      this.studioState_.animationRenderer.setAnimationTime(this.animTime || 0);
      currentArtwork = this.studioState_.animationRenderer.renderedArtwork;
    } else {
      currentArtwork = this.artwork;
    }
    let currentAlpha = currentArtwork.alpha;
    if (currentAlpha != 1) {
      offscreenCtx.save();
      offscreenCtx.scale(this.backingStoreScale_, this.backingStoreScale_);
      offscreenCtx.clearRect(0, 0, currentArtwork.width, currentArtwork.height);
    }
    let artworkCtx = currentAlpha == 1 ? ctx : offscreenCtx;
    drawLayer_(artworkCtx, currentArtwork);

    if (currentArtwork.alpha != 1) {
      let oldGlobalAlpha = ctx.globalAlpha;
      ctx.globalAlpha = currentAlpha;
      ctx.scale(1 / this.backingStoreScale_, 1 / this.backingStoreScale_);
      ctx.drawImage(offscreenCtx.canvas, 0, 0);
      ctx.scale(this.backingStoreScale_, this.backingStoreScale_);
      ctx.globalAlpha = oldGlobalAlpha;
      offscreenCtx.restore();
    }
    if (!this.isPreviewMode) {
      drawLayer_(ctx, currentArtwork, true);
    }

    ctx.restore();

    // draw pixel grid
    if (!this.isPreviewMode && this.scale_ > 4) {
      ctx.fillStyle = 'rgba(128, 128, 128, .25)';

      for (let x = 1; x < this.artwork.width; ++x) {
        ctx.fillRect(
            x * this.backingStoreScale_ - 0.5 * (window.devicePixelRatio || 1),
            0,
            1 * (window.devicePixelRatio || 1),
            this.artwork.height * this.backingStoreScale_);
      }

      for (let y = 1; y < this.artwork.height; ++y) {
        ctx.fillRect(
            0,
            y * this.backingStoreScale_ - 0.5 * (window.devicePixelRatio || 1),
            this.artwork.width * this.backingStoreScale_,
            1 * (window.devicePixelRatio || 1));
      }
    }

    if (this.studioState_.playing) {
      this.animationFrameRequest_ = window.requestAnimationFrame(() => {
        this.animTime = ((Number(new Date()) - this.animStart) * this.studioState_.playbackSpeed)
            % this.animation.duration;
        this.scope_.$apply(() => this.studioState_.activeTime = this.animTime);
        this.drawCanvas_();
      });
    }
  }
}


angular.module('AVDStudio').directive('studioCanvas', () => {
  return {
    restrict: 'E',
    scope: {},
    templateUrl: 'components/canvas/canvas.html',
    replace: true,
    bindToController: true,
    controller: CanvasController,
    controllerAs: 'ctrl'
  };
});
