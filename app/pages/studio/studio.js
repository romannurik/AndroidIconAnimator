import {LayerGroup, BaseLayer, Artwork, Animation, AnimationBlock} from 'avdstudio/model';
import {SvgLoader} from 'avdstudio/svgloader';

const TEST_DATA = require('avdstudio/test_searchtoback.json');

const BLANK_ARTWORK = {
  id: new Artwork().typeIdPrefix,
  width: 24,
  height: 24,
  layers: [
  ]
};


const PLAYBACK_SPEEDS = [.1, .25, .5, 1, 2, 3, 4, 8, 10];


class StudioCtrl {
  constructor($scope, $mdToast, StudioStateService) {
    this.scope_ = $scope;
    this.mdToast_ = $mdToast;

    this.studioState_ = StudioStateService;

    this.studioState_.load({
      artwork: new Artwork(TEST_DATA.artwork),
      animations: TEST_DATA.animations.map(anim => new Animation(anim))
    });

    this.setupKeyboardAndUnloadEvents_();
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
        event.preventDefault(); // in case there's a JS error, never navigate away
        this.deleteSelectedLayers_();
        this.deleteSelectedAnimationBlocks_();
        this.deleteSelectedAnimations_();
        return false;

      } else if (event.metaKey && event.keyCode == "G".charCodeAt(0)) {
        event.shiftKey
            ? this.ungroupSelectedLayers_()
            : this.groupSelectedLayers_();
        return false;

      } else if (event.keyCode == 187
              || event.keyCode == 189
              || event.keyCode == "0".charCodeAt(0)) {
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

    let beforeUnloadHandler_ = event => {
      if (this.studioState_.dirty) {
        return 'You\'ve made changes but haven\'t exported. ' +
               'Are you sure you want to navigate away?';
      }
    };

    $(window)
        .on('keydown', keydownHandler_)
        .on('beforeunload', beforeUnloadHandler_);

    this.scope_.$on('$destroy', () => {
      $(window)
          .off('keydown', keydownHandler_)
          .off('beforeunload', beforeUnloadHandler_);
    });
  }

  onDropFile(fileInfo) {
    if (this.studioState_.dirty) {
      if (!window.confirm('You\'ve made changes but haven\'t exported. ' +
                         'Really load the dropped file?')) {
        return;
      }
    }

    if (fileInfo.type == 'application/json') {
      let jsonObj = JSON.parse(fileInfo.textContent);
      this.studioState_.load({
        artwork: new Artwork(jsonObj.artwork),
        animations: jsonObj.animations.map(anim => new Animation(anim))
      });

    } else if (fileInfo.type == 'image/svg+xml') {
      let artwork = SvgLoader.loadArtworkFromSvgString(fileInfo.textContent);
      this.studioState_.load({
        artwork,
        animations: []
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
