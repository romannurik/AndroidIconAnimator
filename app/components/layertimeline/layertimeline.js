import {Artwork, Layer, LayerGroup, MaskLayer, Animation, AnimationBlock} from 'avdstudio/model';
import {ModelUtil} from 'avdstudio/modelutil';
import {DragHelper} from 'avdstudio/draghelper';


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

    this.horizZoom = 1; // 1ms = 1px

    let $timeline = this.element_.find('.slt-timeline');

    let tempHorizZoom = this.horizZoom;

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

  /**
   * Rebuilds internal layer/timeline related data structures (_slt) about the current
   * artwork and animations.
   */
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

  /**
   * Handles scrubbing (dragging) over the timeline header area, which should
   * change the time cursor.
   */
  onTimelineHeaderScrub(animation, time) {
    this.studioState_.deselectItem(this.studioState_.activeAnimation);
    this.studioState_.activeAnimation = animation;
    this.studioState_.activeTime = time;
    this.studioState_.playing = false;
  }

  /**
   * Called when adding a timeline block from the list of available properties for
   * a given layer.
   */
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

  /**
   * Handles clicks on an animation in the list of current animations.
   */
  onAnimationMouseDown($event, animation) {
    if (this.studioState_.activeAnimation !== animation) {
      this.studioState_.deselectItem(this.studioState_.activeAnimation);
    }
    this.studioState_.activeAnimation = animation;
  }

  /**
   * Called in response to adding a layer of a given type to the artwork.
   */
  onAddLayer($event, type) {
    let cls = (type == 'group')
        ? LayerGroup
        : ((type == 'mask')
            ? MaskLayer
            : Layer);
    let newLayer = new cls();
    newLayer.id = this.studioState_.getUniqueLayerId(null, newLayer);

    // TODO: add just below the selected layer
    newLayer.parent = this.studioState_.artwork; // TODO: this should be automatic
    this.studioState_.artwork.layers.push(newLayer);
    this.studioState_.artworkChanged();
  }

  /**
   * Handles clicks on a layer, either selecting or deselecting it.
   */
  onLayerClick($event, layer) {
    if (this.suppressClick_) {
      return;
    }

    if ($event.metaKey || $event.shiftKey) {
      this.studioState_.toggleSelected(layer);
    } else {
      this.studioState_.selection = [layer];
    }
  }

  /**
   * Creates a new empty animation to the list of animations.
   */
  onAddNewAnimation($event) {
    let newAnim = new Animation({
      id: this.studioState_.getUniqueAnimationId(),
      blocks: [],
      duration: 300
    });
    this.studioState_.deselectItem(this.studioState_.activeAnimation);
    this.studioState_.animations.push(newAnim);
    this.studioState_.activeAnimation = newAnim;
    this.studioState_.animChanged();
  }

  /**
   * Selects the given animation, for inspection w/ the property inspector.
   */
  onAnimationHeaderClick($event, anim) {
    this.studioState_.selection = [anim];
  }

  /**
   * Handles clicks on a timeline block (either selecting or deselecting it).
   */
  onTimelineBlockClick($event, block, layer) {
    if (this.suppressClick_) {
      return;
    }

    if ($event.metaKey || $event.shiftKey) {
      this.studioState_.toggleSelected(block);
    } else {
      this.studioState_.selection = [block];
    }
  }

  /**
   * Handles export to JSON format.
   */
  onExportJSON() {
    this.studioState_.exportJSON();
  }

  /**
   * Handles export to animated vector drawable format.
   */
  onExportAVDs() {
    this.studioState_.exportAVDs();
  }

  /**
   * Handles export to vector drawable format.
   */
  onExportVectorDrawable() {
    this.studioState_.exportVectorDrawable();
  }

  /**
   * Handles a variety of drag behaviors for timeline blocks, including movement
   * and scaling.
   */
  onTimelineBlockMouseDown(event, dragBlock, animation, layer) {
    let $target = $(event.target);

    let animRect = $(event.target).parents('.slt-property').get(0).getBoundingClientRect();
    let xToTime_ = x => (x - animRect.left) / animRect.width * animation.duration;
    let downTime = xToTime_(event.clientX);

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

    let dragHelper = new DragHelper({
      downEvent: event,
      direction: 'horizontal',
      draggingCursor: (action == MouseActions.MOVING) ? 'grabbing' : 'ew-resize',

      onBeginDrag: event => this.suppressClick_ = true,
      onDrop: event => setTimeout(() => this.suppressClick_ = false, 0),

      onDrag: event => {
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
      },
    });
  }

  /**
   * Handles drag and drop for layers, allowing re-ordering and re-parenting layers in
   * the artwork.
   */
  onLayerMouseDown(event, dragLayer) {
    let $layersList = $(event.target).parents('.slt-layers-list');
    let $scroller = $(event.target).parents('.slt-layers-list-scroller');

    let orderedLayerInfos = [];
    let $dragIndicator;
    let scrollerRect;

    let targetLayerInfo = null;
    let targetEdge;

    let EDGES = {top:true, bottom:true};

    let dragHelper = new DragHelper({
      downEvent: event,
      direction: 'both',

      onBeginDrag: () => {
        this.suppressClick_ = true;

        // build up a list of all layers ordered by Y position
        orderedLayerInfos = [];
        scrollerRect = $scroller.get(0).getBoundingClientRect();
        let scrollTop = $scroller.scrollTop();
        $layersList.find('.slt-layer-container').each((i, element) => {
          if (!$(element).data('layer-id')) {
            // the artwork root layer doesn't have an ID set
            return;
          }

          let rect = element.getBoundingClientRect();
          rect = {
            left: rect.left,
            top: rect.top + scrollTop - scrollerRect.top,
            bottom: rect.bottom + scrollTop - scrollerRect.top
          };
          orderedLayerInfos.push({
            layer: this.studioState_.artwork.findLayerById($(element).data('layer-id')),
            localRect: rect,
            element,
          });
        });

        orderedLayerInfos.sort((a, b) => a.localRect.top - b.localRect.top);

        $dragIndicator = $('<div>')
            .addClass('slt-layers-list-drag-indicator')
            .appendTo($scroller);
      },

      onDrag: event => {
        let localEventY = event.clientY - scrollerRect.top + $scroller.scrollTop();

        // find the target layer and edge (top or bottom)
        targetLayerInfo = null;
        let minDistance = Infinity;
        let minDistanceIndent = Infinity; // tie break to most indented layer
        for (let i = 0; i < orderedLayerInfos.length; i++) {
          let layerInfo = orderedLayerInfos[i];

          // skip if mouse to the left of this layer
          if (event.clientX < layerInfo.localRect.left) {
            continue;
          }

          for (let edge in EDGES) {
            // test distance to top edge
            let distance = Math.abs(localEventY - layerInfo.localRect[edge]);
            let indent = layerInfo.localRect.left;
            if (distance <= minDistance) {
              if (distance != minDistance || indent > minDistanceIndent) {
                minDistance = distance;
                minDistanceIndent = indent;
                targetLayerInfo = layerInfo;
                targetEdge = edge;
              }
            }
          }
        }

        // disallow dragging a layer into itself or its children
        if (targetLayerInfo) {
          let layer = targetLayerInfo.layer;
          while (layer) {
            if (layer == dragLayer) {
              targetLayerInfo = null;
              break;
            }

            layer = layer.parent;
          }
        }

        if (targetLayerInfo && targetEdge == 'bottom'
              && targetLayerInfo.layer.nextSibling == dragLayer) {
          targetLayerInfo = null;
        }

        if (targetLayerInfo) {
          $dragIndicator.css('left', targetLayerInfo.localRect.left);
          $dragIndicator.css('top', targetLayerInfo.localRect[targetEdge]);
        }

        $dragIndicator.toggle(!!targetLayerInfo);
      },

      onDrop: event => {
        if ($dragIndicator) {
          $dragIndicator.remove();
        }

        if (targetLayerInfo) {
          this.scope_.$apply(() => {
            let newParent = targetLayerInfo.layer.parent;
            if (newParent) {
              dragLayer.remove();
              let index = newParent.layers.indexOf(targetLayerInfo.layer);
              if (index >= 0) {
                index += (targetEdge == 'top') ? 0 : 1;
                newParent.layers.splice(index, 0, dragLayer);
                dragLayer.parent = newParent;
              }
            }

            this.studioState_.artworkChanged();
          });
        }

        setTimeout(() => this.suppressClick_ = false, 0);
      }
    });
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
