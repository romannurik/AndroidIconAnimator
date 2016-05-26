import {Artwork, Layer, LayerGroup, MaskLayer, AnimationBlock} from 'avdstudio/model';
import {ModelUtil} from 'avdstudio/modelutil';


const DRAG_SLOP = 4; // pixels


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
    if ($event.metaKey || $event.shiftKey) {
      this.studioState_.toggleAnimationBlockSelected(anim);
    } else {
      this.studioState_.selectedAnimationBlocks = [anim];
    }
  }

  onTimelineBlockMouseDown(event, anim, animation, layer) {
    let animRect = $(event.target).parents('.slt-property').get(0).getBoundingClientRect();
    let xToTime_ = x => (x - animRect.left) / animRect.width * animation.duration;
    let downX = event.clientX;
    let downStartTime = anim.startTime;
    let downTime = xToTime_(downX);

    let dragging = false;

    let mouseMoveHandler_ = event => {
      if (!dragging && Math.abs(event.clientX - downX) > DRAG_SLOP) {
        dragging = true;
      }

      if (dragging) {
        let timeDelta = xToTime_(event.clientX) - downTime;
        let animDuration = (anim.endTime - anim.startTime);
        anim.startTime = downStartTime + timeDelta;
        anim.endTime = anim.startTime + animDuration;
        this.studioState_.animChanged();
      }
    };

    let mouseUpHandler_ = event => {
      $(window)
          .off('mousemove', mouseMoveHandler_)
          .off('mouseup', mouseUpHandler_);
      if (dragging) {
        dragging = false;
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
