import {Artwork, Layer, LayerGroup} from 'avdstudio/model';
import ModelUtil from 'avdstudio/model_util';


const DRAG_SLOP = 4; // pixels


class LayerTimelineController {
  constructor($scope, $element, StudioStateService) {
    this.scope_ = $scope;
    this.element_ = $element;
    this.studioState_ = StudioStateService;
    this.studioState_.onChange((event, changes) => {
      if (changes.artwork || changes.artworkAnimations) {
        this.rebuild_();
      }
    }, $scope);

    this.horizZoom = 0.5; // 2ms = 1px

    let $layerList = this.element_.find('.slt-layers');
    let $timeline = this.element_.find('.slt-timeline');

    $layerList.on('scroll', () => {
      let scrollTop = $layerList.scrollTop();
      $timeline.scrollTop(scrollTop);
      this.element_.find('.slt-header').css({top:scrollTop});
    });

    $timeline.on('scroll', () => {
      let scrollTop = $timeline.scrollTop();
      $layerList.scrollTop(scrollTop);
      this.element_.find('.slt-header').css({top:scrollTop});
    });

    this.rebuild_();
  }

  get artwork() {
    return this.studioState_.artwork;
  }

  get activeTime() {
    return this.studioState_.activeTime;
  }

  get artworkAnimations() {
    return this.studioState_.artworkAnimations;
  }

  get activeArtworkAnimation() {
    return this.studioState_.activeArtworkAnimation;
  }

  onTimelineHeaderScrub(artworkAnimation, time) {
    this.studioState_.activeArtworkAnimation = artworkAnimation;
    this.studioState_.activeTime = time;
    this.studioState_.playing = false;
  }

  rebuild_() {
    if (!this.artwork || !this.artworkAnimations) {
      return;
    }

    this.artwork.walk(layer => {
      let _slt = {};
      _slt.layerType = (layer instanceof LayerGroup) ? 'group' : 'layer';
      _slt.propertyAnimations = {};
      layer._slt = _slt;
    });

    this.artworkAnimations.forEach(artworkAnimation => {
      let animations = ModelUtil.getOrderedPropertyAnimationsByLayerId(artworkAnimation);
      Object.keys(animations).forEach(layerId => {
        let layer = this.artwork.findLayerById(layerId);
        if (!layer) {
          return;
        }

        Object.keys(animations[layerId]).forEach(propertyName => {
          layer._slt.propertyAnimations[propertyName]
              = layer._slt.propertyAnimations[propertyName] || {};
          layer._slt.propertyAnimations[propertyName][artworkAnimation.id]
              = animations[layerId][propertyName];
        });
      });
    });
  }

  onHeaderMouseDown($event, artworkAnimation) {
    this.studioState_.activeArtworkAnimation = artworkAnimation;
  }

  onTimelineMouseDown($event, artworkAnimation) {
    this.studioState_.activeArtworkAnimation = artworkAnimation;
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
      this.studioState_.toggleAnimationSelected(anim);
    } else {
      this.studioState_.selectedAnimations = [anim];
    }
  }

  onTimelineBlockMouseDown(event, anim, artworkAnimation, layer) {
    let animRect = $(event.target).parents('.slt-property').get(0).getBoundingClientRect();
    let xToTime_ = x => (x - animRect.left) / animRect.width * artworkAnimation.duration;
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
