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

import {LayerGroup, BaseLayer, Artwork, Animation, AnimationBlock} from 'model';
import {ColorUtil} from 'colorutil';
import {SvgLoader} from 'svgloader';
import {AvdSerializer} from 'avdserializer';

//import TEST_DATA from '../../../_sandbox/debug.iconanim.json';


const PLAYBACK_SPEEDS = [.1, .25, .5, 1, 2, 3, 4, 8, 10];

const DEBUG = !!window.location.search.match(/debug/);



class StudioCtrl {
  constructor($scope, $http, $mdToast, $mdDialog, $timeout, StudioStateService) {
    this.scope_ = $scope;
    this.http_ = $http;
    this.mdToast_ = $mdToast;
    this.mdDialog_ = $mdDialog;
    this.timeout_ = $timeout;
    this.studioState_ = StudioStateService;

    this.previewMode = false;
    this.isLoaded = false;

    this.setupKeyboardAndUnloadEvents_();
    this.setupClipboardEvents_();

    this.loadInitialArtwork_();
  }

  showError_(message, error) {
    this.mdToast_.show(
        this.mdToast_.simple()
          .textContent(message)
          .hideDelay(3000));
    console.error(error);
  }

  loadInitialArtwork_() {
    let exampleMatch = window.location.search.match(/example=(.+)/);
    if (exampleMatch) {
      // Load example
      this.http_({
        url: decodeURIComponent(exampleMatch[1])
      }).then(response => {
        try {
          this.studioState_.load({
            artwork: new Artwork(response.data.artwork),
            animations: response.data.animations.map(anim => new Animation(anim))
          });
        } catch (e) {
          this.showError_('Error parsing example artwork', e);
          this.studioState_.new();
        }
        this.isLoaded = true;

      }, error => {
        this.showError_('Error loading example artwork', error);
        this.studioState_.new();
        this.isLoaded = true;
      });

    // } else if (DEBUG) {
    //   // load debug
    //   this.studioState_.load({
    //     artwork: new Artwork(TEST_DATA.artwork),
    //     animations: TEST_DATA.animations.map(anim => new Animation(anim))
    //   });
    //   this.isLoaded = true;

    } else {
      // load empty artwork
      this.studioState_.new();
      this.isLoaded = true;
    }
  }

  setupClipboardEvents_() {
    let cutCopyHandler_ = (event, shouldCut) => {
      if (document.activeElement.matches('input')) {
        return true;
      }

      let selectedLayers = this.studioState_.selectedLayers;
      if (!selectedLayers) {
        return false;
      }

      let clipboardData = event.originalEvent.clipboardData;
      clipboardData.setData('text/plain', JSON.stringify({
        clipboardType: 'layers',
        layers: selectedLayers
            .filter(l => !(l instanceof Artwork))
            .map(l => l.toJSON())
      }, null, 2));

      if (shouldCut) {
        this.deleteSelectedLayers_();
      }

      return false;
    };

    let cutHandler_ = event => cutCopyHandler_(event, true);
    let copyHandler_ = event => cutCopyHandler_(event, false);

    let pasteHandler_ = event => {
      if (document.activeElement.matches('input')) {
        return true;
      }

      let targetParent = this.studioState_.artwork;
      let firstSelectedItem = this.studioState_.firstSelectedItem;
      if (firstSelectedItem && firstSelectedItem instanceof LayerGroup) {
        targetParent = firstSelectedItem;
      }

      let clipboardData = event.originalEvent.clipboardData;
      let str = clipboardData.getData('text');

      let pasteLayers = null;

      if (str.match(/<\/svg>\s*$/)) {
        // paste SVG
        ga('send', 'event', 'paste', 'svg');
        let artwork = SvgLoader.loadArtworkFromSvgString(str);
        pasteLayers = artwork.layers;

      } else if (str.match(/\}\s*$/)) {
        // paste JSON
        let parsed;
        try {
          parsed = JSON.parse(str);
        } catch (e) {
          console.error(`Couldn't parse JSON: ${str}`);
          return false;
        }

        if (parsed.clipboardType == 'layers') {
          ga('send', 'event', 'paste', 'json.layers');
          pasteLayers = parsed.layers.map(l => BaseLayer.load(l));
        } else {
          ga('send', 'event', 'paste', 'json.unknown');
        }
      }

      if (pasteLayers && pasteLayers.length) {
        let newSelection = [];
        pasteLayers.forEach(layer => {
          layer.parent = targetParent;
          layer.walk(layer => {
            layer.id = this.studioState_.getUniqueLayerId(layer.id, layer);
          });
          targetParent.layers.push(layer);
          newSelection.push(layer);
        });

        this.studioState_.selection = newSelection;
        this.studioState_.artworkChanged();
        return false;
      }
    };

    let digestedCutHandler_ = event => this.scope_.$apply(() => cutHandler_(event));
    let digestedCopyHandler_ = event => this.scope_.$apply(() => copyHandler_(event));
    let digestedPasteHandler_ = event => this.scope_.$apply(() => pasteHandler_(event));

    $(window)
        .on('cut', digestedCutHandler_)
        .on('copy', digestedCopyHandler_)
        .on('paste', digestedPasteHandler_);

    this.scope_.$on('$destroy', () => {
      $(window)
          .off('cut', digestedCutHandler_)
          .off('copy', digestedCopyHandler_)
          .off('paste', digestedPasteHandler_);
    });
  }

  setupKeyboardAndUnloadEvents_() {
    let keydownHandler_ = event => {
      // delete/backspace
      if (document.activeElement.matches('input')) {
        return true;
      }

      if (event.keyCode == 32) {
        // spacebar
        this.studioState_.playing = !this.studioState_.playing;
        return false;

      } else if (event.keyCode == 8) {
        // delete key
        event.preventDefault(); // in case there's a JS error, never navigate away
        this.deleteSelectedLayers_();
        this.deleteSelectedAnimationBlocks_();
        this.deleteSelectedAnimations_();
        return false;

      } else if (event.keyCode == 27) {
        // escape key
        if (this.previewMode) {
          this.previewMode = false;
        }
        return false;

      } else if (event.keyCode == "P".charCodeAt(0)) {
        // preview mode (P key)
        this.previewMode = !this.previewMode;
        return false;

      } else if (event.keyCode == "R".charCodeAt(0)) {
        // rewind (R key)
        this.rewind();
        return false;

      } else if (event.metaKey && event.keyCode == "Z".charCodeAt(0)) {
        // undo/redo (Z key)
        event.shiftKey
            ? this.studioState_.tryRedo()
            : this.studioState_.tryUndo();
        return false;

      } else if (event.metaKey && event.keyCode == "G".charCodeAt(0)) {
        // group/ungroup (G key)
        event.shiftKey
            ? this.ungroupSelectedLayers_()
            : this.groupSelectedLayers_();
        return false;

      } else if (event.keyCode == 187
              || event.keyCode == 189
              || event.keyCode == "0".charCodeAt(0)) {
        // -/+/0 keys to change playback speed
        if (this.studioState_.playing) {
          this.studioState_.playing = false;
          if (event.keyCode == "0".charCodeAt(0)) {
            this.studioState_.playbackSpeed = 1;
          } else {
            let speedUp = !!(event.keyCode == 187);
            let currentIndex = PLAYBACK_SPEEDS.indexOf(this.studioState_.playbackSpeed);
            if (currentIndex < 0) {
              this.studioState_.playbackSpeed = 1;
            } else {
              this.studioState_.playbackSpeed = PLAYBACK_SPEEDS[
                  Math.max(0, Math.min(PLAYBACK_SPEEDS.length - 1,
                      currentIndex + (speedUp ? 1 : -1)))];
            }
          }
          this.studioState_.playing = true;
        }
        return false;
      }
    };

    let digestedKeydownHandler_ = event => this.scope_.$apply(() => keydownHandler_(event));

    let beforeUnloadHandler_ = event => {
      if (this.studioState_.dirty && !DEBUG) {
        return 'You\'ve made changes but haven\'t saved. ' +
               'Are you sure you want to navigate away?';
      }
    };

    $(window)
        .on('keydown', digestedKeydownHandler_)
        .on('beforeunload', beforeUnloadHandler_);

    this.scope_.$on('$destroy', () => {
      $(window)
          .off('keydown', digestedKeydownHandler_)
          .off('beforeunload', beforeUnloadHandler_);
    });
  }

  get previewCanvasCloseButtonTheme() {
    return ColorUtil.isAndroidColorDark(this.studioState_.artwork.canvasColor)
        ? 'dark'
        : 'default';
  }

  get previewCanvasColor() {
    return ColorUtil.androidToCssColor(this.studioState_.artwork.canvasColor);
  }

  isPlaying() {
    return this.studioState_.playing;
  }

  togglePlaying() {
    this.studioState_.playing = !this.studioState_.playing;
  }

  rewind() {
    this.studioState_.playing = false;
    this.timeout_(() => this.studioState_.activeTime = 0, 0);
  }

  restartPlayback() {
    this.studioState_.activeTime = 0;
    this.studioState_.playing = true;
  }

  onDropFile(fileInfo) {
    let confirm_ = () => {
      if (this.studioState_.dirty && !DEBUG) {
        if (!window.confirm('You\'ve made changes but haven\'t saved. ' +
                           'Really load the dropped file?')) {
          return false;
        }
      }

      return true;
    };

    if (fileInfo.type == 'application/json' || fileInfo.name.match(/\.iconanim$/)) {
      ga('send', 'event', 'file', 'openFile.dragDrop');
      if (!confirm_()) {
        return;
      }

      let jsonObj = JSON.parse(fileInfo.textContent);
      this.studioState_.load({
        artwork: new Artwork(jsonObj.artwork),
        animations: jsonObj.animations.map(anim => new Animation(anim))
      });

    } else if (fileInfo.type == 'image/svg+xml') {
      let artwork = SvgLoader.loadArtworkFromSvgString(fileInfo.textContent);

      let startFromScratch_ = () => {
        if (!confirm_()) {
          return;
        }

        ga('send', 'event', 'file', 'importSVG.startFromScratch.dragDrop');
        this.studioState_.load({artwork});
      };

      if (!this.studioState_.artwork.layers.length) {
        startFromScratch_();
        return;
      }

      this.mdDialog_.show({
        title: 'Attention',
        templateUrl: 'pages/studio/dialog-svg-drop.html',
        clickOutsideToClose: true,
        controller: ($scope, $mdDialog) => {
          $scope.closeDialog = () => $mdDialog.hide();

          $scope.startFromScratch = () => {
            startFromScratch_();
            $mdDialog.hide();
          };

          $scope.addLayers = () => {
            ga('send', 'event', 'file', 'importSVG.addLayers.dragDrop');
            this.studioState_.addLayers(artwork.layers);
            $mdDialog.hide();
          };
        }
      });
    }
  }

  deleteSelectedLayers_() {
    if (this.studioState_.firstSelectedItem instanceof BaseLayer) {
      // delete layers
      this.studioState_.deleteLayers(this.studioState_.selectedLayers);
      this.studioState_.selection = null;
      this.studioState_.artworkChanged();
      this.studioState_.animChanged();
    }
  }

  deleteSelectedAnimationBlocks_() {
    if (this.studioState_.firstSelectedItem instanceof AnimationBlock) {
      // delete animations
      let selectedAnimationBlocks = this.studioState_.selectedAnimationBlocks;
      this.studioState_.animations.forEach(animation => {
        for (let i = animation.blocks.length - 1; i >= 0; --i) {
          let block = animation.blocks[i];
          if (selectedAnimationBlocks.indexOf(block) >= 0) {
            animation.blocks.splice(i, 1);
          }
        }
      });

      this.studioState_.selection = null;
      this.studioState_.animChanged();
      return false;
    }
  }

  deleteSelectedAnimations_() {
    if (this.studioState_.firstSelectedItem instanceof Animation) {
      // delete animations
      this.studioState_.activeAnimation = null;
      this.studioState_.animations = this.studioState_.animations.filter(
          animation => animation !== this.studioState_.firstSelectedItem);
      this.studioState_.selection = null;
      this.studioState_.animChanged();
      return false;
    }
  }

  groupOrUngroupSelectedLayers_(shouldGroup) {
    if (this.studioState_.selectedLayers.length) {
      // sort selected layers by order they appear in tree
      let tempSelLayers = this.studioState_.selectedLayers.slice();
      let selLayerOrders = {};
      let n = 0;
      this.studioState_.artwork.walk(layer => {
        if (tempSelLayers.indexOf(layer) >= 0) {
          selLayerOrders[layer.id] = n;
          ++n;
        }
      });
      tempSelLayers.sort((a, b) => selLayerOrders[a.id] - selLayerOrders[b.id]);

      // either group or ungroup selection
      if (shouldGroup) {
        // group selected layers

        // remove any layers that are descendants of other selected layers,
        // and remove the artwork itself if selected
        tempSelLayers = tempSelLayers.filter(layer => {
          if (layer instanceof Artwork) {
            return false;
          }

          let p = layer.parent;
          while (p) {
            if (tempSelLayers.indexOf(p) >= 0) {
              return false;
            }
            p = p.parent;
          }
          return true;
        });

        if (!tempSelLayers.length) {
          return;
        }

        // find destination parent and insertion point
        let firstSelectedLayerParent = tempSelLayers[0].parent;
        let firstSelectedLayerIndexInParent
            = firstSelectedLayerParent.layers.indexOf(tempSelLayers[0]);

        // remove all selected items from their parents and
        // move them into a new parent
        let newGroup = new LayerGroup({
          id: this.studioState_.getUniqueLayerId('group'),
          layers: tempSelLayers
        });
        tempSelLayers.forEach(layer =>
            layer.parent.layers.splice(layer.parent.layers.indexOf(layer), 1));
        newGroup.parent = firstSelectedLayerParent;
        firstSelectedLayerParent.layers.splice(firstSelectedLayerIndexInParent, 0, newGroup);

        this.studioState_.artworkChanged();
        this.studioState_.animChanged();
        this.studioState_.selection = [newGroup];

      } else {
        // ungroup selected layer groups
        let newSelectedLayers = [];
        tempSelLayers
            .filter(layer => layer instanceof LayerGroup && !(layer instanceof Artwork))
            .forEach(layerGroup => {
              // move children into parent
              let parent = layerGroup.parent;
              let indexInParent = Math.max(0, parent.layers.indexOf(layerGroup));
              parent.layers.splice(indexInParent, 0, ...layerGroup.layers);
              newSelectedLayers.splice(0, 0, ...layerGroup.layers);
              layerGroup.layers.forEach(layer => layer.parent = parent);
              layerGroup.layers = [];

              // delete the parent
              this.studioState_.deleteLayers(layerGroup);

              this.studioState_.artworkChanged();
              this.studioState_.animChanged();
            });
        this.studioState_.selection = newSelectedLayers;
      }
    }
  }

  groupSelectedLayers_() {
    this.groupOrUngroupSelectedLayers_(true);
  }

  ungroupSelectedLayers_() {
    this.groupOrUngroupSelectedLayers_(false);
  }
}


angular.module('AVDStudio').controller('StudioCtrl', StudioCtrl);
