import routes from 'avdstudio/routes.js';
import {Artwork, ArtworkAnimation} from 'avdstudio/model.js';

const TEST_DATA = require('avdstudio/test_menutoback.js');


class StudioCtrl {
  constructor($scope, $mdToast, StudioStateService) {
    this.scope_ = $scope;
    this.mdToast_ = $mdToast;
    this.loaded = true;

    this.studioState_ = StudioStateService;

    this.studioState_.artwork = new Artwork(TEST_DATA.artwork);
    this.studioState_.artworkAnimations
        = TEST_DATA.animations.map(anim => new ArtworkAnimation(anim));

    $(window).on('keydown', event => {
      if (event.keyCode == 32) {
        // spacebar
        this.studioState_.playing = !this.studioState_.playing;
        return false;
      } else if (event.keyCode == 8) {
        if (this.studioState_.selectedLayers.length) {
          // delete layers
          let deleteAnimationsForLayer_ = layer => {
            layer.walk(layer => {
              this.studioState_.artworkAnimations.forEach(artworkAnimation => {
                artworkAnimation.layerAnimations = artworkAnimation.layerAnimations
                    .filter(layerAnim => layerAnim.layerId != layer.id);
              });
            });
          };

          let selectedLayers = this.studioState_.selectedLayers;
          let visit_ = layerGroup => {
            for (let i = layerGroup.layers.length - 1; i >= 0; --i) {
              let layer = layerGroup.layers[i];
              if (selectedLayers.indexOf(layer) >= 0) {
                deleteAnimationsForLayer_(layer);
                layerGroup.layers.splice(i, 1);
              } else if (layer.layers) {
                visit_(layer);
              }
            }
          };

          visit_(this.studioState_.artwork);

          this.studioState_.selectedLayers = null;
          this.studioState_.artworkChanged();
          this.studioState_.animChanged();
        }
      }
    });
  }
}


angular.module('AVDStudio').controller('StudioCtrl', StudioCtrl);
