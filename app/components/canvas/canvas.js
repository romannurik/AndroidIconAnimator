import {LayerGroup, MaskLayer} from 'avdstudio/model';
import {ColorUtil} from 'avdstudio/colorutil';
import {SvgPathParser} from 'avdstudio/svgpathparser';


class CanvasController {
  constructor($scope, $element, StudioStateService) {
    this.scope_ = $scope;
    this.element_ = $element;
    this.studioState_ = StudioStateService;

    this.studioState_.onChange((event, changes) => {
      if (changes.playing) {
        if (this.studioState_.playing) {
          this.animStart = Number(new Date()) - this.studioState_.activeTime;
        }

        this.drawCanvas_();
      }

      if (changes.activeTime) {
        this.animTime = this.studioState_.activeTime;
        this.drawCanvas_();
      }

      if (changes.artwork || changes.animations || changes.activeAnimation) {
        this.drawCanvas_();
      }
    }, $scope);

    this.drawCanvas_();
  }

  get artwork() {
    return this.studioState_.artwork;
  }

  get animation() {
    return this.studioState_.activeAnimation;
  }

  drawCanvas_() {
    if (this.animationFrameRequest_) {
      window.cancelAnimationFrame(this.animationFrameRequest_);
      this.animationFrameRequest_ = null;
    }

    if (!this.artwork) {
      return;
    }

    let $canvas = this.element_.find('canvas');
    let cssScale = 10;
    let backingStoreScale = cssScale * (window.devicePixelRatio || 1);
    $canvas.attr('width', this.artwork.width * backingStoreScale);
    $canvas.attr('height', this.artwork.height * backingStoreScale);
    $canvas.css({
      width: this.artwork.width * cssScale,
      height: this.artwork.height * cssScale,
    });

    let ctx = $canvas.get(0).getContext('2d');
    ctx.save();
    ctx.scale(backingStoreScale, backingStoreScale);

    let transforms = [];

    let drawLayer = layer => {
      if (layer instanceof LayerGroup) {
        transforms.push(() => {
          ctx.translate(layer.pivotX, layer.pivotY);
          ctx.translate(layer.translateX, layer.translateY);
          ctx.rotate(layer.rotation * Math.PI / 180);
          ctx.scale(layer.scaleX, layer.scaleY);
          ctx.translate(-layer.pivotX, -layer.pivotY);
        });

        ctx.save();
        layer.layers.forEach(layer => drawLayer(layer));
        ctx.restore();

        transforms.pop();
      } else if (layer instanceof MaskLayer) {
        transforms.forEach(t => t());
        SvgPathParser.execute(ctx, layer.pathData.parsed);
        ctx.clip(); // clip further layers

      } else {
        ctx.strokeStyle = ColorUtil.androidToCssColor(layer.strokeColor);
        ctx.lineWidth = layer.strokeWidth;
        ctx.fillStyle = ColorUtil.androidToCssColor(layer.fillColor);
        ctx.lineCap = layer.strokeLinecap || 'butt';

        ctx.save();
        transforms.forEach(t => t());
        SvgPathParser.execute(ctx, layer.pathData.parsed);
        ctx.restore();

        if (layer.trimPathStart !== 0 || layer.trimPathEnd !== 1 || layer.trimPathOffset !== 0) {
          ctx.setLineDash([
            (layer.trimPathEnd - layer.trimPathStart) * layer.pathData.length,
            layer.pathData.length
          ]);
          ctx.lineDashOffset = -(layer.trimPathStart * layer.pathData.length);
        } else {
          ctx.setLineDash([]);
        }

        if (layer.strokeColor && layer.strokeWidth) {
          ctx.stroke();
        }
        if (layer.fillColor) {
          ctx.fill();
        }
      }
    };

    // draw artwork
    if (this.studioState_.animationRenderer) {
      this.studioState_.animationRenderer.setAnimationTime(this.animTime || 0);
      drawLayer(this.studioState_.animationRenderer.renderedArtwork);
    } else {
      drawLayer(this.studioState_.artwork);
    }

    ctx.restore();

    // draw pixel grid
    if (cssScale > 4) {
      ctx.fillStyle = 'rgba(128, 128, 128, .25)';

      for (let x = 1; x < this.artwork.width; ++x) {
        ctx.fillRect(
            x * backingStoreScale - 0.5 * (window.devicePixelRatio || 1),
            0,
            1 * (window.devicePixelRatio || 1),
            this.artwork.height * backingStoreScale);
      }
      for (let y = 1; y < this.artwork.height; ++y) {
        ctx.fillRect(
            0,
            y * backingStoreScale - 0.5 * (window.devicePixelRatio || 1),
            this.artwork.width * backingStoreScale,
            1 * (window.devicePixelRatio || 1));
      }
    }

    if (this.studioState_.playing) {
      this.animationFrameRequest_ = window.requestAnimationFrame(() => {
        this.animTime = (Number(new Date()) - this.animStart) % this.animation.duration;
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
