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

import {
  default as zip
} from 'zipjs-browserify';

import {
  Artwork,
  Animation,
  AnimationBlock,
  BaseLayer
} from 'model';
import {
  AnimationRenderer
} from 'AnimationRenderer';
import {
  AvdSerializer
} from 'AvdSerializer';
import {
  ModelUtil
} from 'ModelUtil';


const CHANGES_TAG = '$$studioState::CHANGES';

const MAX_UNDO_SLOTS = 10;
const UNDO_DEBOUNCE_MS = 1000;


const BLANK_ARTWORK = {
  id: new Artwork().typeIdPrefix,
  width: 24,
  height: 24,
  layers: []
};


const BLANK_ANIMATION = {
  id: new Animation().typeIdPrefix,
  duration: 300,
};


class StudioStateService {
  constructor($rootScope, $timeout) {
    this.rootScope_ = $rootScope;
    this.timeout_ = $timeout;
    this.rebuildRenderer_();
  }

  load(obj) {
    this.artwork_ = obj.artwork;
    this.animations_ = obj.animations || [new Animation(BLANK_ANIMATION)];

    this.undoStates_ = [];
    this.currentUndoState_ = -1;
    this.debouncedSaveUndoPromise_ = null;

    this.activeTime_ = 0;
    this.playing_ = false;
    this.selection_ = null;

    this.activeAnimation_ = this.animations_.length ? this.animations_[0] : null;

    this.rebuildRenderer_();

    this.broadcastChanges_({
      artwork: true,
      animations: true,
      selection: true,
      activeTime: true,
      playing: true,
      isReset: true
    });

    this.dirty_ = false;
    this.saveUndoState_();
  }

  get playbackSpeed() {
    return this.playbackSpeed_ || 1;
  }

  set playbackSpeed(speed) {
    this.playbackSpeed_ = speed;
  }

  get playing() {
    return this.playing_;
  }

  set playing(playing) {
    this.playing_ = playing;
    this.broadcastChanges_({
      playing: true
    });
  }

  get artwork() {
    // if (this.currentUndoState_ >= 0) {
    //   return this.undoStates_[this.currentUndoState_].artwork;
    // }

    return this.artwork_;
  }

  set artwork(artwork) {
    this.artwork_ = artwork;
    this.artworkChanged({
      noUndo: true
    });
  }

  get animations() {
    // if (this.currentUndoState_ >= 0) {
    //   return this.undoStates_[this.currentUndoState_].animations;
    // }

    return (this.animations_ = this.animations_ || []);
  }

  set animations(animations) {
    this.animations_ = animations;
    if (animations.indexOf(this.activeAnimation) < 0) {
      this.activeAnimation = animations[0];
    }
    this.animChanged();
  }

  animChanged(options = {}) {
    this.dirty_ = true;
    this.rebuildRenderer_();
    this.broadcastChanges_({
      animations: true
    });
    if (!options.noUndo) {
      this.saveUndoState_({
        debounce: true
      });
    }
  }

  artworkChanged(options = {}) {
    this.dirty_ = true;
    this.rebuildRenderer_();
    this.broadcastChanges_({
      artwork: true
    });
    if (!options.noUndo) {
      this.saveUndoState_({
        debounce: true
      });
    }
  }

  saveUndoState_(options = {}) {
    // if there's a pending debounce, defer it
    if (this.debouncedSaveUndoPromise_) {
      this.timeout_.cancel(this.debouncedSaveUndoPromise_);
      this.undoStates_.shift();
    }

    // step 1: stage a new slot for the undo state
    if (this.currentUndoState_ > 0) {
      // currently in an undo state, blow away all undo states after this one
      this.undoStates_.splice(0, this.currentUndoState_);
    }

    this.undoStates_.unshift(null);
    this.currentUndoState_ = 0;

    // cap the max number of undo states
    this.undoStates_.splice(MAX_UNDO_SLOTS, this.undoStates_.length - MAX_UNDO_SLOTS);

    // step 2: either commit the current state right away, or debounce
    // (commit the current state after N millisec of inactivity)
    if (options.debounce) {
      this.debouncedSaveUndoPromise_ = this.timeout_(
        () => this.commitUndoStateToTopSlot_(), UNDO_DEBOUNCE_MS);
    } else {
      this.commitUndoStateToTopSlot_();
    }
  }

  commitUndoStateToTopSlot_() {
    this.undoStates_[0] = {
      artwork: new Artwork(this.artwork_),
      animations: (this.animations_ || []).map(anim => new Animation(anim)),
      activeAnimationIndex: (this.animations_ || []).indexOf(this.activeAnimation_)
    };
    this.debouncedSaveUndoPromise_ = null;
  }

  realizeUndoState_() {
    let state = this.undoStates_[this.currentUndoState_];
    this.artwork_ = new Artwork(state.artwork);
    this.animations_ = state.animations.map(anim => new Animation(anim));
    this.activeAnimation_ = (this.animations_.length > 0 && state.activeAnimationIndex >= 0) ?
      this.animations_[state.activeAnimationIndex] :
      null;
    this.selection = [];
    this.artworkChanged({
      noUndo: true
    });
    this.animChanged({
      noUndo: true
    });
  }

  tryUndo() {
    // if there's a debounced commit of undo state, commit it now
    if (this.debouncedSaveUndoPromise_) {
      this.timeout_.cancel(this.debouncedSaveUndoPromise_);
      this.commitUndoStateToTopSlot_();
    }

    if (this.currentUndoState_ < this.undoStates_.length - 1) {
      ++this.currentUndoState_;
      this.realizeUndoState_();
    }
  }

  tryRedo() {
    if (this.currentUndoState_ > 0) {
      --this.currentUndoState_;
      this.realizeUndoState_();
    }
  }

  get dirty() {
    return !!this.dirty_;
  }

  set dirty(dirty) {
    this.dirty_ = dirty;
  }

  get animationRenderer() {
    return this.animationRenderer_;
  }

  get activeAnimation() {
    // if (this.currentUndoState_ >= 0) {
    //   let currentUndoState = this.undoStates_[this.currentUndoState_];
    //   return currentUndoState.animations[currentUndoState.activeAnimationIndex];
    // }

    return this.activeAnimation_ || (this.animations.length && this.animations[0]);
  }

  set activeAnimation(activeAnimation) {
    if (this.activeAnimation_ === activeAnimation) {
      return;
    }

    this.activeAnimation_ = activeAnimation;
    this.rebuildRenderer_();
    this.broadcastChanges_({
      activeAnimation: true
    });
  }

  rebuildRenderer_() {
    this.animationRenderer_ = null;
    if (this.activeAnimation) {
      this.animationRenderer_ = new AnimationRenderer(
        this.artwork,
        this.activeAnimation);
      this.animationRenderer_.setAnimationTime(this.activeTime_);
    }
  }

  get activeTime() {
    return this.activeTime_ || 0;
  }

  set activeTime(activeTime) {
    this.activeTime_ = activeTime;
    if (this.animationRenderer_) {
      this.animationRenderer_.setAnimationTime(activeTime);
    }
    this.broadcastChanges_({
      activeTime: true
    });
  }

  getSelectionByType_(type) {
    return (this.selection_ && this.selection_.length && this.selection_[0] instanceof type) ?
      this.selection_ : [];
  }

  get selectedLayers() {
    return this.getSelectionByType_(BaseLayer);
  }

  get selectedAnimationBlocks() {
    return this.getSelectionByType_(AnimationBlock);
  }

  get selectedAnimations() {
    return this.getSelectionByType_(Animation);
  }

  get firstSelectedItem() {
    return ((this.selection_ || []).length > 0) ? this.selection_[0] : null;
  }

  get isMultipleSelection() {
    return this.selection_ ? !!(this.selection_.length > 1) : false;
  }

  get selection() {
    return this.selection_ || [];
  }

  set selection(selection) {
    this.selection_ = this.selection_ || [];
    this.selection_.forEach(item => delete item.selected_);
    this.selection_ = selection ? selection.slice() : [];
    this.selection_.forEach(item => item.selected_ = true);
    this.broadcastChanges_({
      selection: true
    });
  }

  areItemsMultiselectCompatible_(item1, item2) {
    return !!(!item1 || !item2 ||
      item1.constructor === item2.constructor ||
      item1 instanceof BaseLayer && item2 instanceof BaseLayer);
  }

  selectItem(item) {
    this.toggleSelected(item, true);
  }

  deselectItem(item) {
    this.toggleSelected(item, false);
  }

  toggleSelected(item, select) {
    if (!item) {
      return;
    }

    if (select === undefined) {
      select = !item.selected_;
    }

    if (!!item.selected_ == select) {
      return;
    }

    this.selection_ = this.selection_ || [];

    if (select) {
      // ensure only one type of thing is selected
      if (this.areItemsMultiselectCompatible_(this.firstSelectedItem, item)) {
        // add this item to the existing selection
        this.selection_.push(item);
        item.selected_ = true;
      } else {
        // reset the selection
        this.selection = [item];
      }
    } else {
      // simply toggle this item being selected
      let index = this.selection_.indexOf(item);
      if (index >= 0) {
        this.selection_.splice(index, 1);
        delete item.selected_;
      }
    }

    this.broadcastChanges_({
      selection: true
    });
  }

  deleteLayers(layersToDelete) {
    if (!Array.isArray(layersToDelete)) {
      layersToDelete = [layersToDelete];
    }

    let deleteAnimationsForLayer_ = layer => {
      layer.walk(layer => {
        this.animations.forEach(animation => {
          animation.blocks = animation.blocks.filter(block => block.layerId != layer.id);
        });
      });
    };

    let visit_ = layerGroup => {
      for (let i = layerGroup.layers.length - 1; i >= 0; --i) {
        let layer = layerGroup.layers[i];
        if (layersToDelete.indexOf(layer) >= 0) {
          deleteAnimationsForLayer_(layer);
          layerGroup.layers.splice(i, 1);
        } else if (layer.layers) {
          visit_(layer);
        }
      }
    };

    visit_(this.artwork);
    this.artworkChanged();
    this.animChanged();
  }

  updateLayerId(layer, newId) {
    let oldId = layer.id;
    if (oldId == newId) {
      return;
    }

    this.animations.forEach(animation => animation.blocks.forEach(block => {
      if (block.layerId == oldId) {
        block.layerId = newId;
      }
    }));
    layer.id = newId;

    this.artworkChanged();
    this.animChanged();
  }

  getUniqueAnimationId(prefix, targetAnimation = null) {
    return ModelUtil.getUniqueId({
      prefix: prefix || 'anim',
      objectById: id => this.animations.reduce((a, b) => a || (b.id == id), false),
      skipObject: targetAnimation
    });
  }

  getUniqueLayerId(prefix, targetLayer = null) {
    return ModelUtil.getUniqueId({
      prefix: prefix || (targetLayer ? targetLayer.typeIdPrefix : 'layer'),
      objectById: id => this.artwork.findLayerById(id),
      skipObject: targetLayer
    });
  }

  broadcastChanges_(changes) {
    // todo: debounce
    this.rootScope_.$emit(CHANGES_TAG, changes);
  }

  onChange(fn, $scope) {
    let watcher = this.rootScope_.$on(CHANGES_TAG, function () {
      // window.setTimeout(() => $scope.$apply(() => fn.apply(this, arguments)), 0);
      fn.apply(this, arguments);
    });
    $scope.$on('$destroy', () => watcher());
    return watcher;
  }

  downloadFile_(content, filename) {
    let anchor = $('<a>').hide().appendTo(document.body);
    let blob = content;
    if (!(content instanceof Blob)) {
      blob = new Blob([content], {
        type: 'octet/stream'
      });
    }
    let url = window.URL.createObjectURL(blob);
    anchor.attr({
      href: url,
      download: filename
    });
    anchor.get(0).click();
    window.URL.revokeObjectURL(url);
  }

  addLayers(layers) {
    (layers || []).forEach(layer => {
      layer.parent = this.artwork;
      layer.walk(layer => {
        layer.id = this.getUniqueLayerId(layer.id, layer);
      });
      this.artwork.layers.push(layer);
    });
    this.artworkChanged();
  }

  swapLayer(layer, withLayer) {
    let parent = layer.parent;
    let indexInParent = parent.layers.indexOf(layer);
    withLayer.parent = layer.parent;
    parent.layers.splice(indexInParent, 1, withLayer);
    let indexInSelection = this.selection.indexOf(layer);
    if (indexInSelection >= 0) {
      this.selection.splice(indexInSelection, 1, withLayer);
    }
    // TODO: preserve still-valid animations
    this.animations.forEach(animation => {
      animation.blocks = animation.blocks.filter(block => block.layerId != layer.id);
    });
    this.artworkChanged();
  }

  new() {
    this.load({
      artwork: new Artwork(BLANK_ARTWORK),
      animations: [new Animation(BLANK_ANIMATION)]
    });
  }

  saveToFile() {
    let jsonStr = JSON.stringify({
      artwork: this.artwork.toJSON(),
      animations: this.animations.map(anim => anim.toJSON())
    }, null, 2);
    this.downloadFile_(jsonStr, `${this.artwork.id}.iconanim`);
    this.dirty_ = false;
  }

  exportVectorDrawable() {
    let xmlStr = AvdSerializer.artworkToVectorDrawableXmlString(this.artwork);
    this.downloadFile_(xmlStr, `${this.artwork.id}.xml`);
  }

  exportAttrsXml() {
    let xmlStr = AvdSerializer.colorToAttrsXmlString(this.artwork);
    this.downloadFile_(xmlStr, `attrs.xml`);
  }

  exportColorsXml() {
    let xmlStr = AvdSerializer.colorToColorsXmlString(this.artwork);
    this.downloadFile_(xmlStr, `colors.xml`);
  }

  exportStylesXml() {
    let xmlStr = AvdSerializer.colorToStylesXmlString(this.artwork);
    this.downloadFile_(xmlStr, `styles.xml`);
  }

  exportAVDs(withColorsAttrs) {
    if (this.animations.length) {
      let exportedAnimations = this.animations.map(animation => ({
        animation,
        filename: `avd_${this.artwork.id}_${animation.id}.xml`,
        xmlStr: AvdSerializer.artworkAnimationToAvdXmlString(this.artwork, animation, withColorsAttrs)
      }));


      if (exportedAnimations.length == 1) {
        if (withColorsAttrs) {
          // download a ZIP
          zip.createWriter(new zip.BlobWriter(), writer => {
            // add next file
            writer.add(
              exportedAnimations[0].filename,
              new zip.TextReader(exportedAnimations[0].xmlStr),
              () => {
                writer.add(
                  'attrs.xml',
                  new zip.TextReader(AvdSerializer.colorToAttrsXmlString(this.artwork)),
                  () => {
                    writer.add(
                      'colors.xml',
                      new zip.TextReader(AvdSerializer.colorToColorsXmlString(this.artwork)),
                      () => {
                        writer.add(
                          'styles.xml',
                          new zip.TextReader(AvdSerializer.colorToStylesXmlString(this.artwork)),
                          () => {
                            writer.close(blob => this.downloadFile_(blob, `avd_${this.artwork.id}.zip`));
                          });
                      });
                  });
              });
          }, error => console.error(error));
        } else {
          // download a single XML
          this.downloadFile_(exportedAnimations[0].xmlStr, exportedAnimations[0].filename);
        }
      } else {
        // download a ZIP
        zip.createWriter(new zip.BlobWriter(), writer => {
          let i = -1;
          let next_ = () => {
            ++i;
            if (i >= exportedAnimations.length) {
              if (withColorsAttrs) {
                writer.add(
                  'attrs.xml',
                  new zip.TextReader(AvdSerializer.colorToAttrsXmlString(this.artwork)),
                  () => {
                    writer.add(
                      'colors.xml',
                      new zip.TextReader(AvdSerializer.colorToColorsXmlString(this.artwork)),
                      () => {
                        writer.add(
                          'styles.xml',
                          new zip.TextReader(AvdSerializer.colorToStylesXmlString(this.artwork)),
                          () => {
                            // close
                            writer.close(blob => this.downloadFile_(blob, `avd_${this.artwork.id}.zip`));
                          });
                      });
                  });
              } else {
                // close
                writer.close(blob => this.downloadFile_(blob, `avd_${this.artwork.id}.zip`));
              }
            } else {
              // add next file
              let exportedAnimation = exportedAnimations[i];
              writer.add(
                exportedAnimation.filename,
                new zip.TextReader(exportedAnimation.xmlStr),
                next_);
            }
          };
          next_();
        }, error => console.error(error));
      }
    }
  }
}


angular.module('AVDStudio').service('StudioStateService', StudioStateService);