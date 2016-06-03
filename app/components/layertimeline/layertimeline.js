import {Artwork, Layer, LayerGroup, MaskLayer, AnimationBlock} from 'avdstudio/model';
import {ModelUtil} from 'avdstudio/modelutil';


const DRAG_SLOP = 4; // pixels


const MouseActions = {
  MOVING: 0,
  SCALING_UNIFORM_START: 1,
  SCALING_UNIFORM_END: 2,
  SCALING_TOGETHER_START: 3,
  SCALING_TOGETHER_END: 4,
};


class LayerTimelineController {
  constructor($scope, $element, StudioStateService) {
    this.scope_ = $scope;
    this.element_ = $element;
    this.studioState_ = StudioStateService;
    this.studioState_.onChange((event, changes) => {
      if (changes.artwork || changes.animations) {
        this.rebuild_();
      }
    }, $scope);

    this.horizZoom = 0.5; // 2ms = 1px

    let $layerList = this.element_.find('.slt-layers-list-scroller');
    let $timeline = this.element_.find('.slt-timeline');

    $layerList.on('scroll', () => {
      let scrollTop = $layerList.scrollTop();
      $timeline.scrollTop(scrollTop);
      $timeline.find('.slt-header').css({top:scrollTop});
    });

    $timeline.on('scroll', () => {
      let scrollTop = $timeline.scrollTop();
      $layerList.scrollTop(scrollTop);
      $timeline.find('.slt-header').css({top:scrollTop});
    });

    let tempHorizZoom = 0.5;

    let settleZoomTimeout_ = null

    let settleZoom_ = () => {
      $timeline.css('transform', 'none');
      this.horizZoom = tempHorizZoom;
      $scope.$apply();
    };

    $timeline.on('wheel', event => {
      if (event.altKey) {
        event.preventDefault();
        tempHorizZoom *= Math.pow(1.01, event.originalEvent.deltaY);
        let scaleX = tempHorizZoom / this.horizZoom;
        $timeline.css('transform-origin', `0% 0%`);
        $timeline.css('transform', `scale(${scaleX}, 1)`);
        if (settleZoomTimeout_) {
          window.clearTimeout(settleZoomTimeout_);
        }
        settleZoomTimeout_ = window.setTimeout(() => settleZoom_(), 100);
        return false;
      }
    });

    this.rebuild_();
  }

  get artwork() {
    return this.studioState_.artwork;
  }

  get activeTime() {
    return this.studioState_.activeTime;
  }

  get animations() {
    return this.studioState_.animations;
  }

  get activeAnimation() {
    return this.studioState_.activeAnimation;
  }

  onTimelineHeaderScrub(animation, time) {
    this.studioState_.activeAnimation = animation;
    this.studioState_.activeTime = time;
    this.studioState_.playing = false;
  }

  rebuild_() {
    if (!this.artwork || !this.animations) {
      return;
    }

    this.artwork.walk(layer => {
      let _slt = {};
      _slt.layerType = (layer instanceof LayerGroup)
          ? 'group'
          : ((layer instanceof MaskLayer) ? 'mask' : 'layer');
      _slt.blocksByProperty = {};
      _slt.availableProperties = layer.animatableProperties;
      layer._slt = _slt;
    });

    this.animations.forEach(animation => {
      let animations = ModelUtil.getOrderedAnimationBlocksByLayerIdAndProperty(animation);
      Object.keys(animations).forEach(layerId => {
        let layer = this.artwork.findLayerById(layerId);
        if (!layer) {
          return;
        }

        Object.keys(animations[layerId]).forEach(propertyName => {
          layer._slt.blocksByProperty[propertyName]
              = layer._slt.blocksByProperty[propertyName] || {};
          layer._slt.blocksByProperty[propertyName][animation.id]
              = animations[layerId][propertyName];
          delete layer._slt.availableProperties[propertyName];
        });
      });
    });
  }

  onAddTimelineBlock($event, layer, propertyName, animation) {
    let valueAtCurrentTime = this.studioState_.animationRenderer
        .getLayerPropertyValue(layer.id, propertyName);
    animation.blocks.push(new AnimationBlock({
      layerId: layer.id,
      propertyName,
      startTime: this.studioState_.activeTime,
      endTime: this.studioState_.activeTime + 100,
      fromValue: valueAtCurrentTime,
      toValue: valueAtCurrentTime,
    }));
    this.studioState_.animChanged();
  }

  onHeaderMouseDown($event, animation) {
    this.studioState_.activeAnimation = animation;
  }

  onTimelineMouseDown($event, animation) {
    this.studioState_.activeAnimation = animation;
  }

  onLayerClick($event, layer) {
    if ($event.metaKey || $event.shiftKey) {
      this.studioState_.toggleLayerSelected(layer);
    } else {
      this.studioState_.selectedLayers = [layer];
    }
  }

  onTimelineBlockClick($event, anim, layer) {
    if (this.suppressClick_) {
      return;
    }

    if ($event.metaKey || $event.shiftKey) {
      this.studioState_.toggleAnimationBlockSelected(anim);
    } else {
      this.studioState_.selectedAnimationBlocks = [anim];
    }
  }

  onTimelineBlockMouseDown(event, dragBlock, animation, layer) {
    let $target = $(event.target);

    let animRect = $(event.target).parents('.slt-property').get(0).getBoundingClientRect();
    let xToTime_ = x => (x - animRect.left) / animRect.width * animation.duration;
    let downX = event.clientX;
    let downTime = xToTime_(downX);

    let dragging = false;

    let blockInfos = (dragBlock.selected_ ? this.studioState_.selectedAnimationBlocks : [dragBlock])
        .map(block => ({block, downStartTime: block.startTime, downEndTime: block.endTime}));

    let action = MouseActions.MOVING;
    if ($target.hasClass('slt-timeline-block-edge-end')) {
      action = event.altKey
          ? MouseActions.SCALING_TOGETHER_END
          : MouseActions.SCALING_UNIFORM_END;
    } else if ($target.hasClass('slt-timeline-block-edge-start')) {
      action = event.altKey
          ? MouseActions.SCALING_TOGETHER_START
          : MouseActions.SCALING_UNIFORM_START;
    }

    let dragBlockDownStartTime = dragBlock.startTime;
    let dragBlockDownEndTime = dragBlock.endTime;

    let minStartTime, maxEndTime;
    if (action == MouseActions.SCALING_TOGETHER_END
        || action == MouseActions.SCALING_TOGETHER_START) {
      minStartTime = blockInfos.reduce(
          (t, info) => Math.min(t, info.block.startTime), Infinity);
      maxEndTime = blockInfos.reduce(
          (t, info) => Math.max(t, info.block.endTime), 0);
      maxEndTime = Math.max(maxEndTime, minStartTime + 10); // avoid divide by zero
    }

    let mouseMoveHandler_ = event => {
      if (!dragging && Math.abs(event.clientX - downX) > DRAG_SLOP) {
        dragging = true;
        this.suppressClick_ = true;
      }

      if (dragging) {
        let timeDelta = xToTime_(event.clientX) - downTime;

        switch (action) {
          case MouseActions.MOVING: {
            let constrainAdjust = 0;
            blockInfos.forEach(info => {
              let blockDuration  = (info.block.endTime - info.block.startTime);
              info.block.startTime = info.downStartTime + timeDelta;
              info.block.endTime = info.block.startTime + blockDuration;
              constrainAdjust = Math.max(constrainAdjust, -info.block.startTime);
              constrainAdjust = Math.min(constrainAdjust, animation.duration - info.block.endTime);
            });
            blockInfos.forEach(info => {
              info.block.startTime += constrainAdjust;
              info.block.endTime += constrainAdjust;
            });
            break;
          }

          case MouseActions.SCALING_UNIFORM_START: {
            let constrainAdjust = 0;
            blockInfos.forEach(info => {
              info.block.startTime = info.downStartTime + timeDelta;
              constrainAdjust = Math.max(constrainAdjust, -info.block.startTime);
              constrainAdjust = Math.min(constrainAdjust,
                  info.block.endTime - info.block.startTime - 10);
            });
            blockInfos.forEach(info => info.block.startTime += constrainAdjust);
            break;
          }

          case MouseActions.SCALING_TOGETHER_START: {
            let scale = (dragBlockDownStartTime + timeDelta - maxEndTime)
                / (dragBlockDownStartTime - maxEndTime);
            scale = Math.min(scale, maxEndTime / (maxEndTime - minStartTime));
            blockInfos.forEach(info => {
              info.block.startTime = maxEndTime - (maxEndTime - info.downStartTime) * scale;
              info.block.endTime = Math.max(
                  maxEndTime - (maxEndTime - info.downEndTime) * scale,
                  info.block.startTime + 10);
            });
            break;
          }

          case MouseActions.SCALING_UNIFORM_END: {
            let constrainAdjust = 0;
            blockInfos.forEach(info => {
              info.block.endTime = info.downEndTime + timeDelta;
              constrainAdjust = Math.max(constrainAdjust,
                  info.block.startTime - info.block.endTime + 10);
              constrainAdjust = Math.min(constrainAdjust, animation.duration - info.block.endTime);
            });
            blockInfos.forEach(info => info.block.endTime += constrainAdjust);
            break;
          }

          case MouseActions.SCALING_TOGETHER_END: {
            let scale = (dragBlockDownEndTime + timeDelta - minStartTime)
                / (dragBlockDownEndTime - minStartTime);
            scale = Math.min(scale, (animation.duration - minStartTime) / (maxEndTime - minStartTime));
            blockInfos.forEach(info => {
              info.block.startTime = minStartTime + (info.downStartTime - minStartTime) * scale;
              info.block.endTime = Math.max(
                  minStartTime + (info.downEndTime - minStartTime) * scale,
                  info.block.startTime + 10);
            });
            break;
          }
        }

        this.studioState_.animChanged();
      }
    };

    let mouseUpHandler_ = event => {
      $(window)
          .off('mousemove', mouseMoveHandler_)
          .off('mouseup', mouseUpHandler_);
      if (dragging) {
        dragging = false;
        setTimeout(() => this.suppressClick_ = false, 0);
        event.stopPropagation();
        event.preventDefault();
        return false;
      }
    };

    $(window)
          .on('mousemove', mouseMoveHandler_)
          .on('mouseup', mouseUpHandler_);
  }
}


angular.module('AVDStudio').directive('studioLayerTimeline', () => {
  return {
    restrict: 'E',
    scope: {},
    templateUrl: 'components/layertimeline/layertimeline.html',
    replace: true,
    bindToController: true,
    controller: LayerTimelineController,
    controllerAs: 'ctrl'
  };
});


// timeline grid
