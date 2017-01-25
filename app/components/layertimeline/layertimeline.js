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

import {Artwork, PathLayer, LayerGroup, MaskLayer, Animation, AnimationBlock} from 'model';
import {ModelUtil} from 'modelutil';
import {UiUtil} from 'uiutil';
import {DragHelper} from 'draghelper';
import {SvgLoader} from 'svgloader';
import {VectorDrawableLoader} from 'vectordrawableloader';
import {TimelineConsts} from './consts.js';


const LAYER_INDENT = 20; // pixels

const SNAP_PIXELS = 10; // distance in pixels from a snap point before snapping to the point

const MIN_BLOCK_DURATION = 10; // 10ms

const MAX_ZOOM = 10;
const MIN_ZOOM = 0.01;


const MouseActions = {
  MOVING: 0,
  SCALING_UNIFORM_START: 1,
  SCALING_UNIFORM_END: 2,
  SCALING_TOGETHER_START: 3,
  SCALING_TOGETHER_END: 4,
};


class LayerTimelineController {
  constructor($scope, $element, $timeout, StudioStateService) {
    this.scope_ = $scope;
    this.element_ = $element;
    this.timeout_ = $timeout;
    this.studioState_ = StudioStateService;
    this.studioState_.onChange((event, changes) => {
      if (changes.artwork || changes.animations) {
        this.rebuildModel_();
        this.rebuildSnapTimes_();
      }
      if (changes.isReset) {
        this.autoZoomToAnimation();
      }
    }, $scope);

    this.horizZoom = 2; // 1ms = 2px

    this.setupMouseWheelZoom_();

    this.rebuildModel_();
    this.rebuildSnapTimes_();
    this.autoZoomToAnimation();
  }

  get horizZoom() {
    return this.horizZoom_;
  }

  set horizZoom(val) {
    this.horizZoom_ = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, val));
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
    let $zoomStartActiveAnimation;
    let targetHorizZoom;
    let performZoomRAF = null;
    let endZoomTimeout = null;
    let zoomStartTimeCursorPos;

    $timeline.on('wheel', event => {
      if (event.altKey || event.ctrlKey) { // chrome+mac trackpad pinch-zoom = ctrlKey
        if (!targetHorizZoom) {
        // multiple changes can happen to targetHorizZoom before the
        // actual zoom level is updated (see performZoom_)
          targetHorizZoom = this.horizZoom;
        }

        event.preventDefault();
        targetHorizZoom *= Math.pow(1.01, -event.originalEvent.deltaY);
        targetHorizZoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, targetHorizZoom));
        if (targetHorizZoom != this.horizZoom) {
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
      this.horizZoom = targetHorizZoom;
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
      targetHorizZoom = 0;
    };
  }

  /**
   * Rebuilds internal layer/timeline related data structures (_slt) about the current
   * artwork and animations.
   */
  rebuildModel_() {
    if (!this.artwork || !this.animations) {
      return;
    }

    let isEmptyObj_ = obj => {
      for (let k in obj) {
        return false;
      }
      return true;
    };

    this.artwork.walk(layer => {
      let _slt = {};
      _slt.layerType = (layer instanceof LayerGroup)
          ? 'group'
          : ((layer instanceof MaskLayer) ? 'mask' : 'layer');
      _slt.blocksByProperty = {};
      _slt.availableProperties = layer.animatableProperties;
      _slt.hasAvailableProperties = !isEmptyObj_(_slt.availableProperties);
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
          layer._slt.hasAvailableProperties = !isEmptyObj_(layer._slt.availableProperties);
        });
      });
    });
  }

  /**
   * Zooms the timeline to fit the first animation.
   */
  autoZoomToAnimation() {
    if (this.animations.length) {
      UiUtil.waitForElementWidth_(this.element_.find('.slt-timeline'))
          .then(width => {
            width -= 100; // shave off a hundred pixels for safety
            let zoom = width / this.animations[0].duration;
            this.horizZoom = zoom;
          });
    }
  }

  /**
   * Handles scrubbing (dragging) over the timeline header area, which should
   * change the time cursor.
   */
  onTimelineHeaderScrub(animation, time, options) {
    options = options || {};
    if (!options.disableSnap) {
      time = this.snapTime_(animation, time, false);
    }

    this.studioState_.deselectItem(this.studioState_.activeAnimation);
    this.studioState_.activeAnimation = animation;
    this.studioState_.activeTime = time;
    this.studioState_.playing = false;
  }

  /**
   * Builds a cache of snap times for all available animations.
   */
  rebuildSnapTimes_() {
    if (this.suppressRebuildSnapTimes_) {
      return;
    }

    this.snapTimes_ = {};
    if (this.animations) {
      this.animations.forEach(animation => {
        let snapTimes = new Set([]);
        snapTimes.add(0);
        snapTimes.add(animation.duration);
        animation.blocks.forEach(block => {
          snapTimes.add(block.startTime);
          snapTimes.add(block.endTime);
        });
        this.snapTimes_[animation.id] = Array.from(snapTimes);
      });
    }
  }

  /**
   * Returns a new time, possibly snapped to animation boundaries
   */
  snapTime_(animation, time, includeActiveTime = true) {
    let snapTimes = this.snapTimes_[animation.id];
    let snapDelta = SNAP_PIXELS / this.horizZoom;
    let reducer_ = (bestSnapTime, snapTime) => {
      let dist = Math.abs(time - snapTime);
      return (dist < snapDelta && dist < Math.abs(time - bestSnapTime))
          ? snapTime
          : bestSnapTime;
    };
    let bestSnapTime = snapTimes.reduce(reducer_, Infinity);
    if (includeActiveTime) {
      bestSnapTime = reducer_(bestSnapTime, this.activeTime);
    }
    return isFinite(bestSnapTime) ? bestSnapTime : time;
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
    let blockNeighbors = (blocksByLayerId[layer.id] || {})[propertyName] || [];
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
   * Handles creating a new file
   */
  onNewFile() {
    if (this.studioState_.dirty) {
      if (!window.confirm('You\'ve made changes but haven\'t saved. ' +
                         'Really create a new file?')) {
        return;
      }
    }

    ga('send', 'event', 'file', 'newFile');
    this.studioState_.new();
  }

  /**
   * Handles opening a file using a file open dialog
   */
  onOpenFile(fileInfo) {
    if (this.studioState_.dirty) {
      if (!window.confirm('You\'ve made changes but haven\'t saved. ' +
                         'Really open this file?')) {
        return;
      }
    }

    ga('send', 'event', 'file', 'openFile');
    let jsonObj = JSON.parse(fileInfo.textContent);
    this.studioState_.load({
      artwork: new Artwork(jsonObj.artwork),
      animations: jsonObj.animations.map(anim => new Animation(anim))
    });
  }

  /**
   * Handles export to JSON format.
   */
  onSaveFile() {
    ga('send', 'event', 'file', 'saveFile');
    this.studioState_.saveToFile();
  }

  /**
   * Handles importing an SVG as layers.
   */
  onAddLayersFromSVG(fileInfo) {
    ga('send', 'event', 'file', 'importSVG.addLayers');
    let artwork = SvgLoader.loadArtworkFromSvgString(fileInfo.textContent);
    this.studioState_.addLayers(artwork.layers);
  }

  /**
   * Handles importing a vector drawable from XML.
   */
  onImportVD(fileInfo) {
    ga('send', 'event', 'file', 'importVD');
    let artwork = VectorDrawableLoader.loadArtworkFromXmlString(fileInfo.textContent);
    this.studioState_.load({artwork});
  }

  /**
   * Handles export to animated vector drawable format.
   */
  onExportAVDs() {
    ga('send', 'event', 'export', 'exportVectorAnimated');
    this.studioState_.exportAVDs();
  }

  /**
   * Handles export to vector drawable format.
   */
  onExportVectorDrawable() {
    ga('send', 'event', 'export', 'exportVectorStatic');
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
                  downStartTime: block.startTime,
                  downEndTime: block.endTime};
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

      onBeginDrag: event => this.scope_.$apply(() => {
        this.suppressClick_ = true;
        this.suppressRebuildSnapTimes_ = true;
      }),
      onDrop: event => this.timeout_(() => {
        this.suppressClick_ = false;
        this.suppressRebuildSnapTimes_ = false;
        this.rebuildSnapTimes_();
      }, 0),

      onDrag: event => this.scope_.$apply(() => {
        let timeDelta = Math.round(xToTime_(event.clientX) - downTime);
        let allowSnap = !event.altKey;

        switch (action) {
          case MouseActions.MOVING: {
            blockInfos.forEach(info => {
              // snap timedelta
              if (allowSnap && info.block == dragBlock) {
                let newStartTime = info.downStartTime + timeDelta;
                let newStartTimeSnapDelta = this.snapTime_(animation, newStartTime) - newStartTime;
                let newEndTime = info.downEndTime + timeDelta;
                let newEndTimeSnapDelta = this.snapTime_(animation, newEndTime) - newEndTime;
                if (newStartTimeSnapDelta) {
                  if (newEndTimeSnapDelta) {
                    timeDelta += Math.min(newStartTimeSnapDelta, newEndTimeSnapDelta);
                  } else {
                    timeDelta += newStartTimeSnapDelta;
                  }
                } else if (newEndTimeSnapDelta) {
                  timeDelta += newEndTimeSnapDelta;
                }
              }
              // constrain timeDelta
              timeDelta = Math.min(timeDelta, info.endBound - info.downEndTime);
              timeDelta = Math.max(timeDelta, info.startBound - info.downStartTime);
            });
            blockInfos.forEach(info => {
              let blockDuration  = (info.block.endTime - info.block.startTime);
              info.block.startTime = info.downStartTime + timeDelta;
              info.block.endTime = info.block.startTime + blockDuration;
            });
            break;
          }

          case MouseActions.SCALING_UNIFORM_START: {
            blockInfos.forEach(info => {
              // snap timedelta
              if (allowSnap && info.block == dragBlock) {
                let newStartTime = info.downStartTime + timeDelta;
                let newStartTimeSnapDelta = this.snapTime_(animation, newStartTime) - newStartTime;
                if (newStartTimeSnapDelta) {
                  timeDelta += newStartTimeSnapDelta;
                }
              }
              // constrain timeDelta
              timeDelta = Math.min(timeDelta, (info.block.endTime - MIN_BLOCK_DURATION) - info.downStartTime);
              timeDelta = Math.max(timeDelta, info.startBound - info.downStartTime);
            });
            blockInfos.forEach(info => info.block.startTime = info.downStartTime + timeDelta);
            break;
          }

          case MouseActions.SCALING_UNIFORM_END: {
            blockInfos.forEach(info => {
              // snap timedelta
              if (allowSnap && info.block == dragBlock) {
                let newEndTime = info.downEndTime + timeDelta;
                let newEndTimeSnapDelta = this.snapTime_(animation, newEndTime) - newEndTime;
                if (newEndTimeSnapDelta) {
                  timeDelta += newEndTimeSnapDelta;
                }
              }
              // constrain timeDelta
              timeDelta = Math.min(timeDelta, info.endBound - info.downEndTime);
              timeDelta = Math.max(timeDelta, (info.block.startTime + MIN_BLOCK_DURATION) - info.downEndTime);
            });
            blockInfos.forEach(info => info.block.endTime = info.downEndTime + timeDelta);
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
                  info.newStartTime + MIN_BLOCK_DURATION);
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

          case MouseActions.SCALING_TOGETHER_END: {
            let scale = (dragBlockDownEndTime + timeDelta - minStartTime)
                / (dragBlockDownEndTime - minStartTime);
            scale = Math.min(scale, (animation.duration - minStartTime) / (maxEndTime - minStartTime));
            let cancel = false;
            blockInfos.forEach(info => {
              info.newStartTime = minStartTime + (info.downStartTime - minStartTime) * scale;
              info.newEndTime = Math.max(
                  minStartTime + (info.downEndTime - minStartTime) * scale,
                  info.newStartTime + MIN_BLOCK_DURATION);
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
      }),
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

          let layer = this.studioState_.artwork.findLayerById($(element).data('layer-id'));
          orderedLayerInfos.push({
            layer,
            element,
            localRect: rect,
          });

          // add a fake target for empty groups
          if (layer instanceof LayerGroup && !layer.layers.length) {
            rect = Object.assign({}, rect, {left: rect.left + LAYER_INDENT, top: rect.bottom});
            orderedLayerInfos.push({
              layer,
              element,
              localRect: rect,
              moveIntoEmptyLayerGroup: true,
            });
          }
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
            if (targetLayerInfo.moveIntoEmptyLayerGroup) {
              // moving into an empty layer group
              let newParent = targetLayerInfo.layer;
              dragLayer.remove();
              newParent.layers.push(dragLayer);
              dragLayer.parent = newParent;
            } else {
              // moving next to another layer
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
            }

            this.studioState_.artworkChanged();
          });
        }

        this.timeout_(() => this.suppressClick_ = false, 0);
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
