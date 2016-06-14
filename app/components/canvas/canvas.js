import {LayerGroup, MaskLayer} from 'avdstudio/model';
import {ColorUtil} from 'avdstudio/colorutil';
import {SvgPathData} from 'avdstudio/svgpathdata';
import {ElementResizeWatcher} from 'avdstudio/elementresizewatcher';


const CANVAS_MARGIN = 64; // pixels


class CanvasController {
  constructor($scope, $element, StudioStateService, $timeout) {
    this.scope_ = $scope;
    this.element_ = $element;
    this.canvas_ = $element.find('canvas');
    this.studioState_ = StudioStateService;

    this.studioState_.onChange((event, changes) => {
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
    }, $scope);

    let resizeWatcher = new ElementResizeWatcher(this.element_, () => this.resizeAndDrawCanvas_());
    $scope.$on('$destroy', () => resizeWatcher.destroy());

    $timeout(() => this.resizeAndDrawCanvas_(), 0);
  }

  get artwork() {
    return this.studioState_.artwork;
  }

  get animation() {
    return this.studioState_.activeAnimation;
  }

  resizeAndDrawCanvas_() {
    let containerWidth = this.element_.width() - CANVAS_MARGIN * 2;
    let containerHeight = this.element_.height() - CANVAS_MARGIN * 2;
    let containerAspectRatio = containerWidth / (containerHeight || 1);

    let artworkAspectRatio = this.artwork.width / (this.artwork.height || 1);

    if (artworkAspectRatio > containerAspectRatio) {
      this.scale_ = containerWidth / this.artwork.width;
    } else {
      this.scale_ = containerHeight / this.artwork.height;
    }

    this.scale_ = Math.floor(this.scale_);

    this.backingStoreScale_ = this.scale_ * (window.devicePixelRatio || 1);
    this.canvas_
        .attr({
          width: this.artwork.width * this.backingStoreScale_,
          height: this.artwork.height * this.backingStoreScale_
        })
        .css({
          width: this.artwork.width * this.scale_,
          height: this.artwork.height * this.scale_,
        });
    this.drawCanvas_();
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

    let drawLayer_ = (layer, selectionMode) => {
      if (layer instanceof LayerGroup) {
        transforms.push(() => {
          ctx.translate(layer.pivotX, layer.pivotY);
          ctx.translate(layer.translateX, layer.translateY);
          ctx.rotate(layer.rotation * Math.PI / 180);
          ctx.scale(layer.scaleX, layer.scaleY);
          ctx.translate(-layer.pivotX, -layer.pivotY);
        });

        ctx.save();
        layer.layers.forEach(layer => drawLayer_(layer, selectionMode));
        ctx.restore();

        if (selectionMode && layer.selected) {
          let bounds = layer.computeBounds();
          if (bounds) {
            ctx.save();
            transforms.forEach(t => t());
            ctx.beginPath();
            ctx.rect(bounds.l, bounds.t, bounds.r - bounds.l, bounds.b - bounds.t);
            ctx.restore();
            selectionStroke_();
          }
        }

        transforms.pop();
      } else if (layer instanceof MaskLayer) {
        ctx.save();
        transforms.forEach(t => t());
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
        ctx.save();
        transforms.forEach(t => t());
        layer.pathData && layer.pathData.execute(ctx);
        ctx.restore();

        if (!selectionMode) {
          // draw the actual layer
          ctx.strokeStyle = ColorUtil.androidToCssColor(layer.strokeColor);
          ctx.lineWidth = layer.strokeWidth;
          ctx.fillStyle = ColorUtil.androidToCssColor(layer.fillColor);
          ctx.lineCap = layer.strokeLinecap || 'butt';

          if (layer.trimPathStart !== 0 || layer.trimPathEnd !== 1 || layer.trimPathOffset !== 0) {
            let shownFraction = (layer.trimPathEnd - layer.trimPathStart);
            ctx.setLineDash([
              shownFraction * layer.pathData.length,
              (1 - shownFraction + 0.001) * layer.pathData.length
            ]);
            ctx.lineDashOffset = -((layer.trimPathOffset + layer.trimPathStart) * layer.pathData.length);
          } else {
            ctx.setLineDash([]);
          }

          if (layer.strokeColor && layer.strokeWidth && layer.trimPathStart != layer.trimPathEnd) {
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
    if (this.studioState_.animationRenderer) {
      this.studioState_.animationRenderer.setAnimationTime(this.animTime || 0);
      drawLayer_(this.studioState_.animationRenderer.renderedArtwork);
      drawLayer_(this.studioState_.animationRenderer.renderedArtwork, true);
    } else {
      drawLayer_(this.studioState_.artwork);
      drawLayer_(this.studioState_.artwork, true);
    }

    ctx.restore();

    // draw pixel grid
    if (this.scale_ > 4) {
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
        this.studioState_.activeTime = this.animTime;
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
