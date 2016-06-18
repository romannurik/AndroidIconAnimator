import {Artwork, PathLayer, LayerGroup, MaskLayer, Animation, AnimationBlock} from 'model';
import {ModelUtil} from 'modelutil';
import {DragHelper} from 'draghelper';
import TimelineConsts from './consts.js';


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

    this.horizZoom = .25; // 1ms = 1px

    this.setupMouseWheelZoom_();

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
   * Handles alt+mousewheel for zooming into and out of the timeline.
   */
  setupMouseWheelZoom_() {
    let $timeline = this.element_.find('.slt-timeline');
    let tempHorizZoom = this.horizZoom;
    let performZoomRAF = null;
    let endZoomTimeout = null;
    let zoomStartTimeCursorPos;
    let $zoomStartActiveAnimation;

    $timeline.on('wheel', event => {
      if (event.altKey || event.ctrlKey) { // chrome+mac trackpad pinch-zoom = ctrlKey
        event.preventDefault();
        tempHorizZoom *= Math.pow(1.01, -event.originalEvent.deltaY);
        tempHorizZoom = Math.max(0.01, Math.min(10, tempHorizZoom));
        if (tempHorizZoom != this.horizZoom) {
          // zoom has changed
          if (performZoomRAF) {
            window.cancelAnimationFrame(performZoomRAF);
          }
          performZoomRAF = window.requestAnimationFrame(() => performZoom_());

          if (endZoomTimeout) {
            window.clearTimeout(endZoomTimeout);
          } else {
            startZoom_();
          }

          endZoomTimeout = window.setTimeout(() => endZoom_(), 100);
        }
        return false;
      }
    });

    let startZoom_ = () => {
      $zoomStartActiveAnimation = $('.slt-timeline-animation.is-active');
      zoomStartTimeCursorPos = $zoomStartActiveAnimation.position().left
          + this.activeTime * this.horizZoom + TimelineConsts.TIMELINE_ANIMATION_PADDING;
    };

    let performZoom_ = () => {
      this.horizZoom = tempHorizZoom;
      this.scope_.$apply();

      // set the scroll offset such that the time cursor remains at
      // zoomStartTimeCursorPos
      if ($zoomStartActiveAnimation) {
        let newScrollLeft = $zoomStartActiveAnimation.position().left
            + $timeline.scrollLeft()
            + this.activeTime * this.horizZoom + TimelineConsts.TIMELINE_ANIMATION_PADDING
            - zoomStartTimeCursorPos;
        $timeline.scrollLeft(newScrollLeft);
      }
    };

    let endZoom_ = () => {
      zoomStartTimeCursorPos = 0;
      $zoomStartActiveAnimation = null;
      endZoomTimeout = null;
    };
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
      let blocksByLayerId = ModelUtil.getOrderedAnimationBlocksByLayerIdAndProperty(animation);
      Object.keys(blocksByLayerId).forEach(layerId => {
        let layer = this.artwork.findLayerById(layerId);
        if (!layer) {
          return;
        }

        Object.keys(blocksByLayerId[layerId]).forEach(propertyName => {
          layer._slt.blocksByProperty[propertyName]
              = layer._slt.blocksByProperty[propertyName] || {};
          layer._slt.blocksByProperty[propertyName][animation.id]
              = blocksByLayerId[layerId][propertyName];
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
   * Called when adding a new timeline block to a property that's already animated
   */
  onAddTimelineBlock($event, layer, propertyName) {
    let animation = this.studioState_.activeAnimation;

    let newBlockDuration = 100; // min duration of 100ms

    // find the right start time for the block, which should be a gap between
    // neighboring blocks closest to the time cursor (activeTime), of a minimum size
    let blocksByLayerId = ModelUtil.getOrderedAnimationBlocksByLayerIdAndProperty(animation);
    let blockNeighbors = blocksByLayerId[layer.id][propertyName];
    let gaps = [];
    for (let i = 0; i < blockNeighbors.length; i++) {
      gaps.push({
        start: (i == 0) ? 0 : blockNeighbors[i - 1].endTime,
        end: blockNeighbors[i].startTime
      });
    }
    gaps.push({
      start: blockNeighbors.length ? blockNeighbors[blockNeighbors.length - 1].endTime : 0,
      end: animation.duration
    });
    gaps = gaps
        .filter(gap => gap.end - gap.start > newBlockDuration)
        .map(gap => Object.assign(gap, {
          dist: Math.min(
              Math.abs(gap.end - this.studioState_.activeTime),
              Math.abs(gap.start - this.studioState_.activeTime))
        }))
        .sort((a, b) => a.dist - b.dist);

    if (!gaps.length) {
      // no available gaps, cancel
      return;
    }

    let startTime = Math.max(this.studioState_.activeTime, gaps[0].start);
    let endTime = Math.min(startTime + newBlockDuration, gaps[0].end);
    if (endTime - startTime < newBlockDuration) {
      startTime = endTime - newBlockDuration;
    }

    // generate the new block, cloning the current rendered property value
    let propertyObj = layer.animatableProperties[propertyName];
    let valueAtCurrentTime = this.studioState_.animationRenderer
        .getLayerPropertyValue(layer.id, propertyName);
    let newBlock = new AnimationBlock({
      layerId: layer.id,
      propertyName,
      startTime,
      endTime,
      fromValue: propertyObj.cloneValue(valueAtCurrentTime),
      toValue: propertyObj.cloneValue(valueAtCurrentTime),
    });

    // add the block
    newBlock.parent = animation;
    animation.blocks.push(newBlock);
    this.studioState_.selection = [newBlock];
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
            : PathLayer);
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
    event.preventDefault(); // prevent html5 dragging
    let $target = $(event.target);

    // some geometry and hit-testing basics
    let animRect = $(event.target).parents('.slt-property').get(0).getBoundingClientRect();
    let xToTime_ = x => (x - animRect.left) / animRect.width * animation.duration;
    let downTime = xToTime_(event.clientX);

    // determine the action based on where the user clicked and the modifier keys
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

    // start up a cache of info for each selected block, calculating the left- and right-
    // bounds for each selected block, based on adjacent non-dragging blocks
    let activeAnimBlocksByLayerId = ModelUtil.getOrderedAnimationBlocksByLayerIdAndProperty(
        this.studioState_.activeAnimation);
    let draggingBlocks = (dragBlock.selected_
        ? this.studioState_.selectedAnimationBlocks
        : [dragBlock]); // either drag all selected blocks or just the mousedown'd block
    let blockInfos = draggingBlocks
        .filter(block => block.parent == this.studioState_.activeAnimation)
        .map(block => {
          // by default the block is only bound by the animation duration
          let startBound = 0;
          let endBound = block.parent.duration;

          let blockNeighbors = activeAnimBlocksByLayerId[block.layerId][block.propertyName];
          let indexIntoNeighbors = blockNeighbors.indexOf(block);

          // find start time bound
          if (indexIntoNeighbors > 0) {
            for (let i = indexIntoNeighbors - 1; i >= 0; i--) {
              let neighbor = blockNeighbors[i];
              if (!draggingBlocks.includes(neighbor)
                  || action == MouseActions.SCALING_UNIFORM_START) {
                startBound = neighbor.endTime; // only be bound by neighbors not being dragged
                                               // except when uniformly changing just start time
                break;
              }
            }
          }

          // find end time bound
          if (indexIntoNeighbors < blockNeighbors.length - 1) {
            for (let i = indexIntoNeighbors + 1; i < blockNeighbors.length; i++) {
              let neighbor = blockNeighbors[i];
              if (!draggingBlocks.includes(neighbor)
                  || action == MouseActions.SCALING_UNIFORM_END) {
                endBound = neighbor.startTime; // only be bound by neighbors not being dragged
                                               // except when uniformly changing just end time
                break;
              }
            }
          }

          return {block, startBound, endBound,
                  downStartTime: block.startTime, downEndTime: block.endTime};
        });

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

    // set up drag handlers
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
              info.newStartTime = info.downStartTime + timeDelta;
              info.newEndTime = info.newStartTime + blockDuration;
              constrainAdjust = Math.max(constrainAdjust, info.startBound - info.newStartTime);
              constrainAdjust = Math.min(constrainAdjust, info.endBound - info.newEndTime);
            });
            blockInfos.forEach(info => {
              info.block.startTime = info.newStartTime + constrainAdjust;
              info.block.endTime = info.newEndTime + constrainAdjust;
            });
            break;
          }

          case MouseActions.SCALING_UNIFORM_START: {
            let constrainAdjust = 0;
            blockInfos.forEach(info => {
              info.newStartTime = info.downStartTime + timeDelta;
              constrainAdjust = Math.max(constrainAdjust, info.startBound - info.newStartTime);
              constrainAdjust = Math.min(constrainAdjust,
                  info.block.endTime - info.newStartTime - 10);
            });
            blockInfos.forEach(info => info.block.startTime = info.newStartTime + constrainAdjust);
            break;
          }

          case MouseActions.SCALING_TOGETHER_START: {
            let scale = (dragBlockDownStartTime + timeDelta - maxEndTime)
                / (dragBlockDownStartTime - maxEndTime);
            scale = Math.min(scale, maxEndTime / (maxEndTime - minStartTime));
            let cancel = false;
            blockInfos.forEach(info => {
              info.newStartTime = maxEndTime - (maxEndTime - info.downStartTime) * scale;
              info.newEndTime = Math.max(
                  maxEndTime - (maxEndTime - info.downEndTime) * scale,
                  info.newStartTime + 10);
              if (info.newStartTime < info.startBound || info.newEndTime > info.endBound) {
                cancel = true;
              }
            });
            if (!cancel) {
              blockInfos.forEach(info => {
                info.block.startTime = info.newStartTime;
                info.block.endTime = info.newEndTime;
              });
            }
            break;
          }

          case MouseActions.SCALING_UNIFORM_END: {
            let constrainAdjust = 0;
            blockInfos.forEach(info => {
              info.newEndTime = info.downEndTime + timeDelta;
              constrainAdjust = Math.max(constrainAdjust,
                  info.block.startTime - info.newEndTime + 10);
              constrainAdjust = Math.min(constrainAdjust, info.endBound - info.newEndTime);
            });
            blockInfos.forEach(info => info.block.endTime = info.newEndTime + constrainAdjust);
            break;
          }

          case MouseActions.SCALING_TOGETHER_END: {
            let scale = (dragBlockDownEndTime + timeDelta - minStartTime)
                / (dragBlockDownEndTime - minStartTime);
            scale = Math.min(scale, (animation.duration - minStartTime) / (maxEndTime - minStartTime));
            let cancel = false;
            blockInfos.forEach(info => {
              info.newStartTime = minStartTime + (info.downStartTime - minStartTime) * scale;
              info.newEndTime = Math.max(
                  minStartTime + (info.downEndTime - minStartTime) * scale,
                  info.newStartTime + 10);
              if (info.newStartTime < info.startBound || info.newEndTime > info.endBound) {
                cancel = true;
              }
            });
            if (!cancel) {
              blockInfos.forEach(info => {
                info.block.startTime = info.newStartTime;
                info.block.endTime = info.newEndTime;
              });
            }
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
